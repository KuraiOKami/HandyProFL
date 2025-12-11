import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";

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

  const adminSupabase = createServiceRoleClient() ?? supabase;
  const { data: agentProfile } = await adminSupabase
    .from("agent_profiles")
    .select("status")
    .eq("id", session.user.id)
    .single();

  if (agentProfile?.status !== "approved") {
    return { error: NextResponse.json({ error: "Agent approval required" }, { status: 403 }) };
  }

  return { supabase, session, adminSupabase };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getApprovedAgentSession();
  if ("error" in auth) return auth.error;
  const { session, adminSupabase } = auth;

  const { id: requestId } = await params;

  if (!requestId) {
    return NextResponse.json({ error: "Request ID required" }, { status: 400 });
  }

  // Get the service request
  const { data: request, error: reqError } = await adminSupabase
    .from("service_requests")
    .select("id, service_type, status, assigned_agent_id, estimated_minutes")
    .eq("id", requestId)
    .single();

  if (reqError || !request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (!["pending", "confirmed"].includes(request.status || "")) {
    return NextResponse.json({ error: "Request is not available" }, { status: 400 });
  }

  if (request.assigned_agent_id) {
    return NextResponse.json({ error: "Request already assigned" }, { status: 409 });
  }

  // Get pricing from catalog
  const { data: catalogEntry } = await adminSupabase
    .from("service_catalog")
    .select("price_cents, base_minutes")
    .eq("id", request.service_type)
    .single();

  const estimatedMinutes = request.estimated_minutes || catalogEntry?.base_minutes || 60;
  const priceCents =
    catalogEntry?.price_cents ??
    Math.round(estimatedMinutes * DEFAULT_RATE_PER_MINUTE_CENTS);
  const agentPayoutCents = Math.max(1, Math.round(priceCents * AGENT_PAYOUT_PERCENTAGE));
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
      return NextResponse.json({ error: "Request already assigned" }, { status: 409 });
    }
    return NextResponse.json({ error: assignError.message }, { status: 500 });
  }

  // Update service request with assigned agent
  const { error: updateError } = await adminSupabase
    .from("service_requests")
    .update({ assigned_agent_id: session.user.id, status: "confirmed" })
    .eq("id", requestId);

  if (updateError) {
    // Rollback the assignment
    await adminSupabase.from("job_assignments").delete().eq("id", assignment.id);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    assignment_id: assignment.id,
    agent_payout_cents: agentPayoutCents,
  });
}
