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
  const { rating, review } = body ?? {};

  if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
  }

  // Get the job assignment and verify it belongs to this agent
  const { data: assignment, error: assignmentError } = await adminSupabase
    .from("job_assignments")
    .select(`
      id,
      agent_id,
      status,
      request_id,
      service_requests (
        user_id
      )
    `)
    .eq("id", jobId)
    .single();

  if (assignmentError || !assignment) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (assignment.agent_id !== session.user.id) {
    return NextResponse.json({ error: "Not your job" }, { status: 403 });
  }

  // Job must be completed to rate
  if (assignment.status !== "completed") {
    return NextResponse.json({ error: "Can only rate completed jobs" }, { status: 400 });
  }

  // Get client ID from service request
  const serviceRequest = Array.isArray(assignment.service_requests)
    ? assignment.service_requests[0]
    : assignment.service_requests;
  const clientId = serviceRequest?.user_id;

  if (!clientId) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Check if already rated
  const { data: existingRating } = await adminSupabase
    .from("ratings")
    .select("id")
    .eq("job_assignment_id", jobId)
    .eq("rater_type", "agent")
    .single();

  if (existingRating) {
    return NextResponse.json({ error: "You have already rated this client" }, { status: 400 });
  }

  // Create the rating
  const { error: ratingError } = await adminSupabase.from("ratings").insert({
    job_assignment_id: jobId,
    rater_id: session.user.id,
    ratee_id: clientId,
    rater_type: "agent",
    rating: Math.round(rating),
    review: review?.trim() || null,
  });

  if (ratingError) {
    console.error("Rating error:", ratingError);
    return NextResponse.json({ error: "Failed to submit rating" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Rating submitted successfully" });
}

// GET - Check if agent has rated and get any existing rating
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAgentSession();
  if ("error" in auth) return auth.error;
  const { adminSupabase } = auth;

  const { id: jobId } = await params;

  // Check for existing rating by agent
  const { data: rating } = await adminSupabase
    .from("ratings")
    .select("id, rating, review, created_at")
    .eq("job_assignment_id", jobId)
    .eq("rater_type", "agent")
    .single();

  return NextResponse.json({
    hasRated: !!rating,
    rating: rating || null,
  });
}
