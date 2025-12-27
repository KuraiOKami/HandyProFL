import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminSupabase = createServiceRoleClient() ?? supabase;
  const requestId = (await params).id;

  const body = await req.json().catch(() => null);
  const { rating, review } = body ?? {};

  if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
  }

  // Get the service request and verify ownership
  const { data: request, error: requestError } = await adminSupabase
    .from("service_requests")
    .select("id, user_id, status")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (request.user_id !== session.user.id) {
    return NextResponse.json({ error: "Not your booking" }, { status: 403 });
  }

  // Job must be completed to rate
  if (request.status !== "complete" && request.status !== "completed") {
    return NextResponse.json({ error: "Can only rate completed jobs" }, { status: 400 });
  }

  // Get the job assignment to find the agent
  const { data: assignment, error: assignmentError } = await adminSupabase
    .from("job_assignments")
    .select("id, agent_id, status")
    .eq("request_id", requestId)
    .single();

  if (assignmentError || !assignment) {
    return NextResponse.json({ error: "Job assignment not found" }, { status: 404 });
  }

  // Check if already rated
  const { data: existingRating } = await adminSupabase
    .from("ratings")
    .select("id")
    .eq("job_assignment_id", assignment.id)
    .eq("rater_type", "client")
    .single();

  if (existingRating) {
    return NextResponse.json({ error: "You have already rated this job" }, { status: 400 });
  }

  // Create the rating
  const { error: ratingError } = await adminSupabase.from("ratings").insert({
    job_assignment_id: assignment.id,
    rater_id: session.user.id,
    ratee_id: assignment.agent_id,
    rater_type: "client",
    rating: Math.round(rating),
    review: review?.trim() || null,
  });

  if (ratingError) {
    console.error("Rating error:", ratingError);
    return NextResponse.json({ error: "Failed to submit rating" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Rating submitted successfully" });
}

// GET - Check if client has rated and get any existing rating
export async function GET(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminSupabase = createServiceRoleClient() ?? supabase;
  const requestId = (await params).id;

  // Get the job assignment
  const { data: assignment } = await adminSupabase
    .from("job_assignments")
    .select("id")
    .eq("request_id", requestId)
    .single();

  if (!assignment) {
    return NextResponse.json({ hasRated: false, rating: null });
  }

  // Check for existing rating by client
  const { data: rating } = await adminSupabase
    .from("ratings")
    .select("id, rating, review, created_at")
    .eq("job_assignment_id", assignment.id)
    .eq("rater_type", "client")
    .single();

  return NextResponse.json({
    hasRated: !!rating,
    rating: rating || null,
  });
}
