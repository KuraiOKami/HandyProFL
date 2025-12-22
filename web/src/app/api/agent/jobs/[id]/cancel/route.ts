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

  return NextResponse.json({ status: "cancelled" });
}
