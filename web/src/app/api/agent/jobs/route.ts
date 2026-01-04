import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { sanitizeDetailsForAgent } from "@/lib/formatting";

const DEFAULT_PAYOUT_PERCENTAGE = 0.7;
const DEFAULT_RATE_PER_MINUTE_CENTS = 150; // $90/hr fallback

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

  // Fallback: requests assigned to this agent but missing job_assignments row
  const existingRequestIds = (assignments || []).map((a) => a.request_id);
  const { data: assignedRequests } = await adminSupabase
    .from("service_requests")
    .select(`
      id,
      service_type,
      preferred_date,
      preferred_time,
      estimated_minutes,
      details,
      status,
      job_latitude,
      job_longitude,
      total_price_cents,
      labor_price_cents,
      materials_cost_cents,
      profiles:user_id (
        first_name,
        last_name,
        phone,
        street,
        city,
        state,
        postal_code
      )
    `)
    .eq("assigned_agent_id", session.user.id)
    .not("id", "in", `(${existingRequestIds.length ? existingRequestIds.map((id) => `'${id}'`).join(",") : ""}null)`)
    .order("created_at", { ascending: false })
    .limit(20);

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
  const jobsFromAssignments = (assignments || []).map((a) => {
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

  // Fallback jobs for assigned requests without job_assignment rows
  const jobsFromRequests =
    assignedRequests
      ?.map((sr) => {
        const profileRaw = sr.profiles;
        const profile = Array.isArray(profileRaw)
          ? (profileRaw[0] as Record<string, unknown> | null)
          : (profileRaw as Record<string, unknown> | null);

        const estimatedMinutes = (sr.estimated_minutes as number | null) ?? 60;
        const totalCents = (sr.total_price_cents as number | null) ?? 0;
        const laborCents =
          (sr.labor_price_cents as number | null) ??
          (totalCents > 0 ? totalCents - ((sr.materials_cost_cents as number | null) ?? 0) : estimatedMinutes * DEFAULT_RATE_PER_MINUTE_CENTS);
        const materialsCents = (sr.materials_cost_cents as number | null) ?? 0;
        const payoutCents =
          totalCents > 0
            ? Math.round(Math.max(1, totalCents * DEFAULT_PAYOUT_PERCENTAGE))
            : Math.round(Math.max(1, (laborCents + materialsCents) * DEFAULT_PAYOUT_PERCENTAGE));

        return {
          id: sr.id,
          request_id: sr.id,
          service_type: (sr.service_type as string) || "unknown",
          preferred_date: (sr.preferred_date as string) || "",
          preferred_time: (sr.preferred_time as string) || "",
          estimated_minutes: estimatedMinutes,
          details: sanitizeDetailsForAgent(sr.details as string),
          status: (sr.status as string) || "assigned",
          cancellation_reason: null,
          customer_name: profile
            ? `${(profile.first_name as string) || ""} ${(profile.last_name as string) || ""}`.trim()
            : "Customer",
          customer_phone: (profile?.phone as string) || "",
          address: profile
            ? `${(profile.street as string) || ""}, ${(profile.city as string) || ""}, ${(profile.state as string) || ""} ${(profile.postal_code as string) || ""}`.replace(/^, /, "")
            : "",
          city: (profile?.city as string) || "",
          state: (profile?.state as string) || "FL",
          agent_payout_cents: payoutCents,
          started_at: null,
          completed_at: null,
          has_checkin: false,
          has_checkout: false,
          has_box_photo: false,
          has_finished_photo: false,
          job_latitude: sr.job_latitude as number | null,
          job_longitude: sr.job_longitude as number | null,
        };
      }) || [];

  const jobs = [...jobsFromAssignments, ...jobsFromRequests].sort(
    (a, b) => new Date(b.preferred_date || b.started_at || b.completed_at || "").getTime() -
             new Date(a.preferred_date || a.started_at || a.completed_at || "").getTime()
  );

  return NextResponse.json({ jobs });
}
