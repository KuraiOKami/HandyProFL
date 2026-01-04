import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";

async function getAgentSession() {
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

  return { supabase, session, adminSupabase: createServiceRoleClient() ?? supabase };
}

function computeCancellationFee(preferredTime: string | null, preferredDate: string | null) {
  let serviceDate: Date | null = null;

  if (preferredTime) {
    const d = new Date(preferredTime);
    if (!Number.isNaN(d.getTime())) serviceDate = d;
  }

  if (!serviceDate && preferredDate) {
    const d = new Date(`${preferredDate}T12:00:00`);
    if (!Number.isNaN(d.getTime())) serviceDate = d;
  }

  if (!serviceDate) return 0;
  const diffHours = (serviceDate.getTime() - Date.now()) / (1000 * 60 * 60);
  if (diffHours <= 2) return 4000; // $40 within 2 hours
  if (diffHours <= 8) return 2000; // $20 within 2-8 hours
  if (diffHours <= 24) return 1000; // $10 within 8-24 hours
  return 0; // free beyond 24 hours
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAgentSession();
  if ("error" in auth) return auth.error;
  const { session, adminSupabase } = auth;

  const { id: jobId } = await params;

  const body = await req.json().catch(() => null);
  const reason = (body?.reason as string | undefined)?.trim() || "Cancelled by agent";

  // Load assignment + request info
  const { data: assignment, error: fetchError } = await adminSupabase
    .from("job_assignments")
    .select(
      `
        id,
        request_id,
        status,
        service_requests (
          id,
          preferred_time,
          preferred_date
        )
      `
    )
    .eq("id", jobId)
    .eq("agent_id", session.user.id)
    .single();

  if (fetchError || !assignment) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (["cancelled", "completed", "pending_verification", "verified", "paid"].includes(assignment.status || "")) {
    return NextResponse.json({ error: "Job cannot be cancelled at this stage" }, { status: 400 });
  }

  const srRaw = Array.isArray(assignment.service_requests)
    ? assignment.service_requests[0]
    : assignment.service_requests;
  const requestId = srRaw?.id as string | undefined;
  const preferredTime = srRaw?.preferred_time as string | null;

  const nowIso = new Date().toISOString();
  const feeCents = computeCancellationFee(srRaw?.preferred_time as string | null, srRaw?.preferred_date as string | null);

  // Update job assignment
  const { error: updateJobError } = await adminSupabase
    .from("job_assignments")
    .update({ status: "cancelled", cancellation_reason: reason })
    .eq("id", jobId);

  if (updateJobError) {
    return NextResponse.json({ error: updateJobError.message }, { status: 500 });
  }

  // Mark request cancelled and release slot if available
  if (requestId) {
    await adminSupabase
      .from("service_requests")
      .update({
        status: "cancelled",
        cancellation_reason: reason,
        cancelled_at: nowIso,
      })
      .eq("id", requestId);

    if (preferredTime) {
      await adminSupabase.from("available_slots").update({ is_booked: false }).eq("slot_start", preferredTime);
    }
  }

  // Record cancellation fee as negative earning to be netted from next payout
  if (feeCents > 0) {
    // Remove any prior negative fee entries for this assignment to avoid duplicates
    await adminSupabase
      .from("agent_earnings")
      .delete()
      .eq("assignment_id", jobId)
      .lt("amount_cents", 0);

    await adminSupabase.from("agent_earnings").insert({
      agent_id: session.user.id,
      assignment_id: jobId,
      amount_cents: -feeCents,
      status: "available",
      type: "agent_cancel_fee",
      available_at: nowIso,
    });
  }

  return NextResponse.json({ status: "cancelled", fee_cents: feeCents });
}
