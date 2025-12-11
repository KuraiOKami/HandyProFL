import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { sanitizeDetailsForAgent } from "@/lib/formatting";

// Agent payout percentage (70%) and fallback rate when catalog pricing is missing
const AGENT_PAYOUT_PERCENTAGE = 0.7;
const DEFAULT_RATE_PER_MINUTE_CENTS = 150; // $90/hr fallback

async function getApprovedAgentSession() {
  const supabase = await createClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase not configured" }, { status: 500 }) };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "agent") {
    return { error: NextResponse.json({ error: "Agent access required" }, { status: 403 }) };
  }

  // Check if agent is approved
  const adminSupabase = createServiceRoleClient() ?? supabase;
  const { data: agentProfile } = await adminSupabase
    .from("agent_profiles")
    .select("status")
    .eq("id", session.user.id)
    .single();

  if (agentProfile?.status !== "approved") {
    return { error: NextResponse.json({ error: "Agent approval required to view gigs" }, { status: 403 }) };
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
      estimated_minutes,
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
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    const priceCents =
      catalogEntry?.price_cents ??
      Math.round(estimatedMinutes * DEFAULT_RATE_PER_MINUTE_CENTS);
    const agentPayoutCents = Math.max(1, Math.round(priceCents * AGENT_PAYOUT_PERCENTAGE));

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
