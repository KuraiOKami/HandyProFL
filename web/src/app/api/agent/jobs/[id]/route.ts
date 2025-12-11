import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { sanitizeDetailsForAgent } from "@/lib/formatting";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAgentSession();
  if ("error" in auth) return auth.error;
  const { session, adminSupabase } = auth;

  const { id: jobId } = await params;

  // Get the job assignment
  const { data: assignment, error } = await adminSupabase
    .from("job_assignments")
    .select(`
      id,
      request_id,
      status,
      agent_payout_cents,
      started_at,
      completed_at,
      service_requests (
        id,
        service_type,
        preferred_date,
        preferred_time,
        estimated_minutes,
        details,
        job_latitude,
        job_longitude,
        user_id,
        profiles:user_id (
          first_name,
          last_name,
          phone,
          street,
          city,
          state,
          postal_code
        )
      )
    `)
    .eq("id", jobId)
    .eq("agent_id", session.user.id)
    .single();

  if (error || !assignment) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get checkins
  const { data: checkins } = await adminSupabase
    .from("agent_checkins")
    .select("type")
    .eq("assignment_id", jobId);

  // Get proofs
  const { data: proofs } = await adminSupabase
    .from("proof_of_work")
    .select("id, type, photo_url, notes, uploaded_at")
    .eq("assignment_id", jobId)
    .order("uploaded_at", { ascending: true });

  const hasCheckin = checkins?.some((c) => c.type === "checkin") || false;
  const hasCheckout = checkins?.some((c) => c.type === "checkout") || false;
  const hasBoxPhoto = proofs?.some((p) => p.type === "box") || false;
  const hasFinishedPhoto = proofs?.some((p) => p.type === "finished") || false;

  const srRaw = Array.isArray(assignment.service_requests)
    ? assignment.service_requests[0]
    : assignment.service_requests;
  const sr = srRaw as Record<string, unknown> | null;

  const profileRaw = sr?.profiles;
  const profile = Array.isArray(profileRaw)
    ? (profileRaw[0] as Record<string, unknown> | null)
    : (profileRaw as Record<string, unknown> | null);

  const job = {
    id: assignment.id,
    request_id: assignment.request_id,
    service_type: (sr?.service_type as string) || "unknown",
    preferred_date: (sr?.preferred_date as string) || "",
    preferred_time: (sr?.preferred_time as string) || "",
    estimated_minutes: (sr?.estimated_minutes as number) || 60,
    details: sanitizeDetailsForAgent(sr?.details as string),
    status: assignment.status,
    customer_name: profile
      ? `${(profile.first_name as string) || ""} ${(profile.last_name as string) || ""}`.trim()
      : "Customer",
    customer_phone: (profile?.phone as string) || "",
    address: profile
      ? `${(profile.street as string) || ""}, ${(profile.city as string) || ""}, ${(profile.state as string) || ""} ${(profile.postal_code as string) || ""}`.replace(/^, /, "")
      : "",
    city: (profile?.city as string) || "",
    state: (profile?.state as string) || "FL",
    agent_payout_cents: assignment.agent_payout_cents,
    started_at: assignment.started_at,
    completed_at: assignment.completed_at,
    has_checkin: hasCheckin,
    has_checkout: hasCheckout,
    has_box_photo: hasBoxPhoto,
    has_finished_photo: hasFinishedPhoto,
    job_latitude: sr?.job_latitude as number | null,
    job_longitude: sr?.job_longitude as number | null,
  };

  return NextResponse.json({ job, photos: proofs || [] });
}
