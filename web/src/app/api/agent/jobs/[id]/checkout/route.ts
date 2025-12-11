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
  const { latitude, longitude } = body ?? {};

  // Get the job assignment
  const { data: assignment, error } = await adminSupabase
    .from("job_assignments")
    .select("id, status, agent_id, agent_payout_cents")
    .eq("id", jobId)
    .single();

  if (error || !assignment) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (assignment.agent_id !== session.user.id) {
    return NextResponse.json({ error: "Not your job" }, { status: 403 });
  }

  if (assignment.status === "completed") {
    return NextResponse.json({ error: "Job already completed" }, { status: 400 });
  }

  if (assignment.status !== "in_progress") {
    return NextResponse.json({ error: "Must check in first" }, { status: 400 });
  }

  // Check if has checkin
  const { data: checkin } = await adminSupabase
    .from("agent_checkins")
    .select("id")
    .eq("assignment_id", jobId)
    .eq("type", "checkin")
    .single();

  if (!checkin) {
    return NextResponse.json({ error: "Must check in first" }, { status: 400 });
  }

  // Check if already checked out
  const { data: existingCheckout } = await adminSupabase
    .from("agent_checkins")
    .select("id")
    .eq("assignment_id", jobId)
    .eq("type", "checkout")
    .single();

  if (existingCheckout) {
    return NextResponse.json({ error: "Already checked out" }, { status: 400 });
  }

  // Verify both photos are uploaded
  const { data: proofs } = await adminSupabase
    .from("proof_of_work")
    .select("type")
    .eq("assignment_id", jobId);

  const hasBoxPhoto = proofs?.some((p) => p.type === "box");
  const hasFinishedPhoto = proofs?.some((p) => p.type === "finished");

  if (!hasBoxPhoto || !hasFinishedPhoto) {
    return NextResponse.json(
      { error: "Must upload both box and finished photos before checkout" },
      { status: 400 }
    );
  }

  // Create checkout record
  const { error: checkoutError } = await adminSupabase.from("agent_checkins").insert({
    assignment_id: jobId,
    agent_id: session.user.id,
    type: "checkout",
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    location_verified: true, // Checkout doesn't require strict location
    distance_from_job_meters: null,
  });

  if (checkoutError) {
    return NextResponse.json({ error: checkoutError.message }, { status: 500 });
  }

  const now = new Date();
  const checkedOutAt = now.toISOString();

  // Update job status to pending_verification (awaiting admin review)
  // Status flow: assigned -> in_progress -> pending_verification -> verified -> paid -> completed
  const { error: updateError } = await adminSupabase
    .from("job_assignments")
    .update({
      status: "pending_verification",
      checked_out_at: checkedOutAt,
    })
    .eq("id", jobId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Update service request status to indicate work is done but pending verification
  const { data: assignmentFull } = await adminSupabase
    .from("job_assignments")
    .select("request_id")
    .eq("id", jobId)
    .single();

  if (assignmentFull?.request_id) {
    await adminSupabase
      .from("service_requests")
      .update({ status: "pending_verification" })
      .eq("id", assignmentFull.request_id);
  }

  // NOTE: Earnings record is NOT created yet - it will be created when admin verifies and marks as paid
  // This ensures agents only get paid after admin confirms the work quality

  return NextResponse.json({
    ok: true,
    checked_out_at: checkedOutAt,
    status: "pending_verification",
    message: "Job submitted for verification. You'll be paid once the work is confirmed.",
  });
}
