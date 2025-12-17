import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { errorResponse } from "@/lib/api-errors";
import * as Sentry from "@sentry/nextjs";

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

  const adminSupabase = createServiceRoleClient() ?? supabase;
  const { data: agentProfile } = await adminSupabase
    .from("agent_profiles")
    .select("status")
    .eq("id", session.user.id)
    .single();

  if (agentProfile?.status !== "approved") {
    return { error: errorResponse("auth.forbidden", "Agent approval required", 403) };
  }

  return { supabase, session, adminSupabase };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return Sentry.startSpan({ op: "job.accept", name: "Agent accepts gig" }, async (span) => {
    const auth = await getApprovedAgentSession();
    if ("error" in auth) return auth.error;
    const { session, adminSupabase } = auth;

    const { id: requestId } = await params;
    span.setAttribute("request_id", requestId);
    span.setAttribute("agent_id", session.user.id);

    if (!requestId) {
      return errorResponse("request.invalid", "Request ID required", 400);
    }

    // Get the service request
    const { data: request, error: reqError } = await adminSupabase
      .from("service_requests")
      .select(
        "id, service_type, status, assigned_agent_id, estimated_minutes, total_price_cents, labor_price_cents, materials_cost_cents"
      )
      .eq("id", requestId)
      .single();

    if (reqError || !request) {
      return errorResponse("request.not_found", "Request not found", 404);
    }

    if (!["pending", "confirmed"].includes(request.status || "")) {
      return errorResponse("gig.unavailable", "Request is not available", 400);
    }

    if (request.assigned_agent_id) {
      return errorResponse("request.conflict", "Request already assigned", 409);
    }

    // Get pricing from catalog (fallback if request pricing isn't stored)
    const { data: catalogEntry } = await adminSupabase
      .from("service_catalog")
      .select("price_cents, base_minutes")
      .eq("id", request.service_type)
      .single();

    const estimatedMinutes = request.estimated_minutes || catalogEntry?.base_minutes || 60;

    const storedTotalCents = normalizeCents((request as { total_price_cents?: number | null }).total_price_cents);
    const storedLaborCents = normalizeCents((request as { labor_price_cents?: number | null }).labor_price_cents);
    const storedMaterialsCents =
      normalizeCents((request as { materials_cost_cents?: number | null }).materials_cost_cents) ?? 0;

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
    span.setAttribute("service_type", request.service_type);
    span.setAttribute("total_price_cents", totalCents);
    span.setAttribute("labor_price_cents", baseLaborCents);
    span.setAttribute("materials_cost_cents", storedMaterialsCents);
    span.setAttribute("agent_payout_cents", agentPayoutCents);
    const platformFeeCents = totalCents - agentPayoutCents;

    // Create job assignment
    const { data: assignment, error: assignError } = await adminSupabase
      .from("job_assignments")
      .insert({
        request_id: requestId,
        agent_id: session.user.id,
        assigned_by: "agent",
        job_price_cents: totalCents,
        agent_payout_cents: agentPayoutCents,
        platform_fee_cents: platformFeeCents,
        status: "assigned",
      })
      .select("id")
      .single();

    if (assignError) {
      // Check if it's a unique constraint violation (already assigned)
      if (assignError.code === "23505") {
        return errorResponse("request.conflict", "Request already assigned", 409);
      }
      return errorResponse("internal.error", assignError.message, 500);
    }

    // Update service request with assigned agent and status to scheduled
    const { error: updateError } = await adminSupabase
      .from("service_requests")
      .update({ assigned_agent_id: session.user.id, status: "scheduled" })
      .eq("id", requestId);

    if (updateError) {
      // Rollback the assignment
      await adminSupabase.from("job_assignments").delete().eq("id", assignment.id);
      return errorResponse("internal.error", updateError.message, 500);
    }

    return NextResponse.json({
      ok: true,
      assignment_id: assignment.id,
      agent_payout_cents: agentPayoutCents,
    });
  });
}
