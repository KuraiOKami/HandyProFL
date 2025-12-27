import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { errorResponse } from "@/lib/api-errors";

async function getAgentSession() {
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
  const { latitude, longitude, survey } = body ?? {};

  // Survey data structure
  const surveyData = survey ? {
    satisfaction: survey.satisfaction,
    actual_duration: survey.actual_duration,
    completed_tasks: survey.completed_tasks,
    additional_notes: survey.additional_notes,
  } : null;

  // Get the job assignment
  const { data: assignment, error } = await adminSupabase
    .from("job_assignments")
    .select("id, status, agent_id, agent_payout_cents")
    .eq("id", jobId)
    .single();

  if (error || !assignment) {
    return errorResponse("job.not_found", "Job not found", 404);
  }

  if (assignment.agent_id !== session.user.id) {
    return errorResponse("job.not_assigned", "Not your job", 403);
  }

  if (assignment.status === "completed") {
    return errorResponse("job.invalid_status", "Job already completed", 400);
  }

  if (assignment.status !== "in_progress") {
    return errorResponse("job.invalid_status", "Must check in first", 400);
  }

  // Check if has checkin
  const { data: checkin } = await adminSupabase
    .from("agent_checkins")
    .select("id")
    .eq("assignment_id", jobId)
    .eq("type", "checkin")
    .single();

  if (!checkin) {
    return errorResponse("job.invalid_status", "Must check in first", 400);
  }

  // Check if already checked out
  const { data: existingCheckout } = await adminSupabase
    .from("agent_checkins")
    .select("id")
    .eq("assignment_id", jobId)
    .eq("type", "checkout")
    .single();

  if (existingCheckout) {
    return errorResponse("job.invalid_status", "Already checked out", 400);
  }

  // Verify both photos are uploaded
  const { data: proofs } = await adminSupabase
    .from("proof_of_work")
    .select("type")
    .eq("assignment_id", jobId);

  const hasBoxPhoto = proofs?.some((p) => p.type === "box");
  const hasFinishedPhoto = proofs?.some((p) => p.type === "finished");

  if (!hasBoxPhoto || !hasFinishedPhoto) {
    return errorResponse(
      "request.invalid",
      "Must upload both box and finished photos before checkout",
      400
    );
  }

  // Create checkout record with survey data
  const { error: checkoutError } = await adminSupabase.from("agent_checkins").insert({
    assignment_id: jobId,
    agent_id: session.user.id,
    type: "checkout",
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    location_verified: true, // Checkout doesn't require strict location
    distance_from_job_meters: null,
    survey_data: surveyData,
  });

  if (checkoutError) {
    return errorResponse("internal.error", checkoutError.message, 500);
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
    return errorResponse("internal.error", updateError.message, 500);
  }

  // Create a pending earning so it appears in Earnings immediately.
  // It will be made available after admin verification.
  const payoutCents = assignment.agent_payout_cents ?? 0;
  if (payoutCents > 0) {
    const { data: existingEarning } = await adminSupabase
      .from("agent_earnings")
      .select("id, status")
      .eq("assignment_id", jobId)
      .single();

    if (!existingEarning) {
      const { error: earningError } = await adminSupabase.from("agent_earnings").insert({
        agent_id: session.user.id,
        assignment_id: jobId,
        amount_cents: payoutCents,
        status: "pending",
        type: "job_earning",
        available_at: null,
        paid_out_at: null,
        payout_id: null,
      });

      if (earningError) {
        console.error("Failed to create pending earning:", earningError.message);
      }
    }
  }

  // Update service request status to indicate work is done but pending verification
  const { data: assignmentFull } = await adminSupabase
    .from("job_assignments")
    .select("request_id")
    .eq("id", jobId)
    .single();

  if (assignmentFull?.request_id) {
    const { error: requestUpdateError } = await adminSupabase
      .from("service_requests")
      .update({ status: "pending_verification" })
      .eq("id", assignmentFull.request_id);

    if (requestUpdateError) {
      console.error("Failed to update service_request status:", requestUpdateError.message);
    }
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
