import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { errorResponse } from "@/lib/api-errors";
import * as Sentry from "@sentry/nextjs";

// Agent payout percentage (70%) and fallback rate when catalog pricing is missing
const AGENT_PAYOUT_PERCENTAGE = 0.7;
const DEFAULT_RATE_PER_MINUTE_CENTS = 150; // $90/hr fallback

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
  req: NextRequest,
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
    .select("id, service_type, status, assigned_agent_id, estimated_minutes, total_price_cents")
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

  // Get pricing from catalog (fallback if total_price_cents not stored)
  const { data: catalogEntry } = await adminSupabase
    .from("service_catalog")
    .select("price_cents, base_minutes")
    .eq("id", request.service_type)
    .single();

  const estimatedMinutes = request.estimated_minutes || catalogEntry?.base_minutes || 60;
    // Use stored total_price_cents if available (includes add-ons, mount cost, etc.)
    // Otherwise fall back to catalog price or time-based estimate
    const priceCents =
      request.total_price_cents ??
      catalogEntry?.price_cents ??
      Math.round(estimatedMinutes * DEFAULT_RATE_PER_MINUTE_CENTS);
    const agentPayoutCents = Math.max(1, Math.round(priceCents * AGENT_PAYOUT_PERCENTAGE));
    span.setAttribute("service_type", request.service_type);
    span.setAttribute("price_cents", priceCents);
    span.setAttribute("agent_payout_cents", agentPayoutCents);
  const platformFeeCents = priceCents - agentPayoutCents;

  // Create job assignment
  const { data: assignment, error: assignError } = await adminSupabase
    .from("job_assignments")
    .insert({
      request_id: requestId,
      agent_id: session.user.id,
      assigned_by: "agent",
      job_price_cents: priceCents,
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
