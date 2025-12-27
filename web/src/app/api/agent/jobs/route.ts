import { NextResponse } from "next/server";
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

export async function GET() {
  const auth = await getAgentSession();
  if ("error" in auth) return auth.error;
  const { session, adminSupabase } = auth;

  // Get all assignments for this agent
  const { data: assignments, error } = await adminSupabase
    .from("job_assignments")
    .select(`
      id,
      request_id,
      status,
      cancellation_reason,
      agent_payout_cents,
      started_at,
      completed_at,
      assigned_at,
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
    .eq("agent_id", session.user.id)
    .order("assigned_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get checkins and proof of work for each assignment
  const assignmentIds = (assignments || []).map((a) => a.id);

  const { data: checkins } = await adminSupabase
    .from("agent_checkins")
    .select("assignment_id, type")
    .in("assignment_id", assignmentIds.length > 0 ? assignmentIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: proofs } = await adminSupabase
    .from("proof_of_work")
    .select("assignment_id, type")
    .in("assignment_id", assignmentIds.length > 0 ? assignmentIds : ["00000000-0000-0000-0000-000000000000"]);

  // Create lookup maps
  const checkinMap = new Map<string, { hasCheckin: boolean; hasCheckout: boolean }>();
  (checkins || []).forEach((c) => {
    const existing = checkinMap.get(c.assignment_id) || { hasCheckin: false, hasCheckout: false };
    if (c.type === "checkin") existing.hasCheckin = true;
    if (c.type === "checkout") existing.hasCheckout = true;
    checkinMap.set(c.assignment_id, existing);
  });

  const proofMap = new Map<string, { hasBox: boolean; hasFinished: boolean }>();
  (proofs || []).forEach((p) => {
    const existing = proofMap.get(p.assignment_id) || { hasBox: false, hasFinished: false };
    if (p.type === "box") existing.hasBox = true;
    if (p.type === "finished") existing.hasFinished = true;
    proofMap.set(p.assignment_id, existing);
  });

  // Transform to job format
  const jobs = (assignments || []).map((a) => {
    const srRaw = Array.isArray(a.service_requests) ? a.service_requests[0] : a.service_requests;
    const sr = srRaw as Record<string, unknown> | null;

    const profileRaw = sr?.profiles;
    const profile = Array.isArray(profileRaw)
      ? (profileRaw[0] as Record<string, unknown> | null)
      : (profileRaw as Record<string, unknown> | null);
    const checkinInfo = checkinMap.get(a.id) || { hasCheckin: false, hasCheckout: false };
    const proofInfo = proofMap.get(a.id) || { hasBox: false, hasFinished: false };

    return {
      id: a.id,
      request_id: a.request_id,
      service_type: (sr?.service_type as string) || "unknown",
      preferred_date: (sr?.preferred_date as string) || "",
      preferred_time: (sr?.preferred_time as string) || "",
      estimated_minutes: (sr?.estimated_minutes as number) || 60,
      details: sanitizeDetailsForAgent(sr?.details as string),
      status: a.status,
      customer_name: profile
        ? `${(profile.first_name as string) || ""} ${(profile.last_name as string) || ""}`.trim()
        : "Customer",
      customer_phone: (profile?.phone as string) || "",
      address: profile
        ? `${(profile.street as string) || ""}, ${(profile.city as string) || ""}, ${(profile.state as string) || ""} ${(profile.postal_code as string) || ""}`.replace(/^, /, "")
        : "",
      city: (profile?.city as string) || "",
      state: (profile?.state as string) || "FL",
      agent_payout_cents: a.agent_payout_cents,
      started_at: a.started_at,
      completed_at: a.completed_at,
      cancellation_reason: a.cancellation_reason,
      has_checkin: checkinInfo.hasCheckin,
      has_checkout: checkinInfo.hasCheckout,
      has_box_photo: proofInfo.hasBox,
      has_finished_photo: proofInfo.hasFinished,
      job_latitude: sr?.job_latitude as number | null,
      job_longitude: sr?.job_longitude as number | null,
    };
  });

  return NextResponse.json({ jobs });
}
