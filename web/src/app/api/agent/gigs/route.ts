import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { sanitizeDetailsForAgent } from "@/lib/formatting";
import { errorResponse } from "@/lib/api-errors";

// Agent payout policy:
// - 70% of labor
// - 100% of materials (reimbursed/pass-through)
// - 50% of any additional surcharge (e.g., urgency/priority fee)
const LABOR_PAYOUT_PERCENTAGE = 0.7;
const SURCHARGE_PAYOUT_PERCENTAGE = 0.5;
const DEFAULT_RATE_PER_MINUTE_CENTS = 150; // $90/hr fallback

function normalizeCents(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

function computeAgentPayoutCents(args: {
  totalCents: number;
  laborCents: number;
  materialsCents: number;
}) {
  const surchargeCents = Math.max(0, args.totalCents - args.laborCents - args.materialsCents);
  const laborPayoutCents = Math.round(args.laborCents * LABOR_PAYOUT_PERCENTAGE);
  const surchargePayoutCents = Math.round(surchargeCents * SURCHARGE_PAYOUT_PERCENTAGE);
  const payoutCents = laborPayoutCents + args.materialsCents + surchargePayoutCents;
  return Math.min(args.totalCents, Math.max(1, payoutCents));
}

async function getApprovedAgentSession() {
  const supabase = await createClient();
  if (!supabase) {
    return { error: errorResponse("service.unconfigured", "Supabase not configured", 500) };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: errorResponse("auth.missing", "Unauthorized", 401) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "agent") {
    return { error: errorResponse("auth.not_agent", "Agent access required", 403) };
  }

  // Check if agent is approved
  const adminSupabase = createServiceRoleClient() ?? supabase;
  const { data: agentProfile } = await adminSupabase
    .from("agent_profiles")
    .select("status")
    .eq("id", session.user.id)
    .single();

  if (agentProfile?.status !== "approved") {
    return { error: errorResponse("auth.forbidden", "Agent approval required to view gigs", 403) };
  }

  return { supabase, session, adminSupabase };
}

export async function GET() {
  const auth = await getApprovedAgentSession();
  if ("error" in auth) return auth.error;
  const { adminSupabase } = auth;

  // Get unassigned, confirmed requests
  const { data: requests, error } = await adminSupabase
    .from("service_requests")
    .select(`
      id,
      service_type,
      preferred_date,
      preferred_time,
      estimated_minutes,
      details,
      status,
      user_id,
      job_latitude,
      job_longitude,
      total_price_cents,
      labor_price_cents,
      materials_cost_cents,
      profiles:user_id (
        city,
        state
      )
    `)
    .in("status", ["pending", "confirmed"])
    .is("assigned_agent_id", null)
    .order("preferred_date", { ascending: true })
    .order("preferred_time", { ascending: true });

  if (error) {
    return errorResponse("internal.error", error.message, 500);
  }

  // Get service catalog for pricing
  const { data: catalog } = await adminSupabase
    .from("service_catalog")
    .select("id, price_cents, base_minutes");

  const catalogMap = new Map(catalog?.map((s) => [s.id, s]) || []);

  // Transform requests to gigs with payout info
  // NOTE: Only expose general location (city/state) before agent accepts the gig
  // Full address, client name, and phone are only available after accepting
  const gigs = (requests || []).map((req) => {
    const profileRaw = Array.isArray(req.profiles) ? req.profiles[0] : req.profiles;
    const profile = profileRaw as {
      city?: string;
      state?: string;
    } | null;
    const catalogEntry = catalogMap.get(req.service_type);
    const estimatedMinutes = req.estimated_minutes || catalogEntry?.base_minutes || 60;

    const storedTotalCents = normalizeCents((req as { total_price_cents?: number | null }).total_price_cents);
    const storedLaborCents = normalizeCents((req as { labor_price_cents?: number | null }).labor_price_cents);
    const storedMaterialsCents =
      normalizeCents((req as { materials_cost_cents?: number | null }).materials_cost_cents) ?? 0;

    // Determine commissioned labor vs surcharge so agents can be reimbursed for materials
    // and fairly share in any urgency/priority fees.
    const baseLaborCents =
      storedLaborCents ??
      catalogEntry?.price_cents ??
      Math.round(estimatedMinutes * DEFAULT_RATE_PER_MINUTE_CENTS);
    const totalCents = storedTotalCents ?? baseLaborCents + storedMaterialsCents;
    const agentPayoutCents = computeAgentPayoutCents({
      totalCents,
      laborCents: baseLaborCents,
      materialsCents: storedMaterialsCents,
    });

    return {
      id: req.id,
      service_type: req.service_type,
      preferred_date: req.preferred_date,
      preferred_time: req.preferred_time,
      estimated_minutes: estimatedMinutes,
      details: sanitizeDetailsForAgent(req.details),
      // Only general area - no street address or zip before accepting
      city: profile?.city || "Unknown",
      state: profile?.state || "FL",
      // Only agent payout - don't expose total job price
      agent_payout_cents: agentPayoutCents,
      has_location: !!(req.job_latitude && req.job_longitude),
    };
  });

  return NextResponse.json({ gigs });
}
