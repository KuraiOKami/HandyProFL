import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { errorResponse } from "@/lib/api-errors";
import { notifyClientJobStarted } from "@/lib/notifications";

// Maximum distance from job location to check in (in meters)
const MAX_CHECKIN_DISTANCE = 100;

// Haversine formula to calculate distance between two points
function getDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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
  const { latitude, longitude } = body ?? {};

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return errorResponse("request.invalid", "Location required", 400);
  }

  // Get the job assignment with request details
  const { data: assignment, error } = await adminSupabase
    .from("job_assignments")
    .select(`
      id,
      request_id,
      status,
      agent_id,
      service_requests (
        id,
        user_id,
        service_type,
        job_latitude,
        job_longitude
      )
    `)
    .eq("id", jobId)
    .single();

  if (error || !assignment) {
    return errorResponse("job.not_found", "Job not found", 404);
  }

  if (assignment.agent_id !== session.user.id) {
    return errorResponse("job.not_assigned", "Not your job", 403);
  }

  if (assignment.status !== "assigned") {
    return errorResponse("job.invalid_status", "Job already started or completed", 400);
  }

  // Check if already checked in
  const { data: existingCheckin } = await adminSupabase
    .from("agent_checkins")
    .select("id")
    .eq("assignment_id", jobId)
    .eq("type", "checkin")
    .single();

  if (existingCheckin) {
    return errorResponse("job.invalid_status", "Already checked in", 400);
  }

  // Verify location (geofencing)
  const srRaw = Array.isArray(assignment.service_requests)
    ? assignment.service_requests[0]
    : assignment.service_requests;
  const sr = srRaw as { id?: string; job_latitude: number | null; job_longitude: number | null } | null;
  let distanceMeters: number | null = null;
  let locationVerified = false;

  if (sr?.job_latitude && sr?.job_longitude) {
    distanceMeters = Math.round(
      getDistanceInMeters(latitude, longitude, sr.job_latitude, sr.job_longitude)
    );
    locationVerified = distanceMeters <= MAX_CHECKIN_DISTANCE;

    if (!locationVerified) {
      return NextResponse.json(
        errorResponse("request.invalid", "Too far from job location", 400, {
          distance_meters: distanceMeters,
          max_distance: MAX_CHECKIN_DISTANCE,
        })
      );
    }
  } else {
    // No job location set, allow check-in without verification
    locationVerified = true;
  }

  // Create checkin record
  const { error: checkinError } = await adminSupabase.from("agent_checkins").insert({
    assignment_id: jobId,
    agent_id: session.user.id,
    type: "checkin",
    latitude,
    longitude,
    location_verified: locationVerified,
    distance_from_job_meters: distanceMeters,
  });

  if (checkinError) {
    return errorResponse("internal.error", checkinError.message, 500);
  }

  // Update job status to in_progress
  const { error: updateError } = await adminSupabase
    .from("job_assignments")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (updateError) {
    return errorResponse("internal.error", updateError.message, 500);
  }

  // Mirror status to service_requests so admins see progress
  const requestId = assignment.request_id || sr?.id;
  if (requestId) {
    await adminSupabase.from("service_requests").update({ status: "in_progress" }).eq("id", requestId);
  }

  // Notify client that job has started
  try {
    const srFull = sr as { id?: string; user_id?: string; service_type?: string; job_latitude: number | null; job_longitude: number | null } | null;
    if (srFull?.user_id) {
      const [agentResult, serviceResult] = await Promise.all([
        adminSupabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", session.user.id)
          .single(),
        adminSupabase
          .from("service_catalog")
          .select("name")
          .eq("id", srFull.service_type || "")
          .single(),
      ]);

      const agentName = [agentResult.data?.first_name, agentResult.data?.last_name]
        .filter(Boolean)
        .join(" ") || "Your agent";
      const serviceName = serviceResult.data?.name || srFull.service_type || "your service";

      await notifyClientJobStarted(adminSupabase, srFull.user_id, {
        agentName,
        serviceName,
        requestId: requestId || srFull.id || "",
      });
    }
  } catch (notifyErr) {
    console.warn("Failed to send job started notification:", notifyErr);
  }

  return NextResponse.json({
    ok: true,
    location_verified: locationVerified,
    distance_meters: distanceMeters,
  });
}
