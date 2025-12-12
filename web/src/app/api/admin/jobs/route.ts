import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";

async function getAdminSession() {
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

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }

  return { supabase, session, adminSupabase: createServiceRoleClient() ?? supabase };
}

export async function GET(req: NextRequest) {
  const auth = await getAdminSession();
  if ("error" in auth) return auth.error;
  const { adminSupabase } = auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  // Build query
  let query = adminSupabase
    .from("job_assignments")
    .select(`
      id,
      request_id,
      agent_id,
      status,
      agent_payout_cents,
      job_price_cents,
      platform_fee_cents,
      assigned_at,
      started_at,
      checked_out_at,
      verified_at,
      paid_at,
      completed_at,
      service_requests (
        id,
        service_type,
        preferred_date,
        preferred_time,
        estimated_minutes,
        user_id,
        profiles:user_id (
          first_name,
          last_name,
          city,
          state
        )
      )
    `)
    .order("assigned_at", { ascending: false })
    .limit(limit);

  // Filter by status if provided
  if (status) {
    query = query.eq("status", status);
  }

  const { data: assignments, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get agent names
  const agentIds = [...new Set((assignments || []).map((a) => a.agent_id))];
  const { data: agents } = await adminSupabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", agentIds.length > 0 ? agentIds : ["00000000-0000-0000-0000-000000000000"]);

  const agentMap = new Map(
    (agents || []).map((a) => [
      a.id,
      `${a.first_name || ""} ${a.last_name || ""}`.trim() || "Agent",
    ])
  );

  // Get proof counts for each job
  const { data: proofCounts } = await adminSupabase
    .from("proof_of_work")
    .select("assignment_id, type")
    .in(
      "assignment_id",
      (assignments || []).map((a) => a.id)
    );

  const proofMap = new Map<string, { box: boolean; finished: boolean }>();
  (proofCounts || []).forEach((p) => {
    const existing = proofMap.get(p.assignment_id) || { box: false, finished: false };
    if (p.type === "box") existing.box = true;
    if (p.type === "finished") existing.finished = true;
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
    const proofInfo = proofMap.get(a.id) || { box: false, finished: false };

    return {
      id: a.id,
      request_id: a.request_id,
      service_type: (sr?.service_type as string) || "unknown",
      preferred_date: (sr?.preferred_date as string) || "",
      preferred_time: (sr?.preferred_time as string) || "",
      estimated_minutes: (sr?.estimated_minutes as number) || 60,
      status: a.status,
      agent_id: a.agent_id,
      agent_name: agentMap.get(a.agent_id) || "Agent",
      customer_name: profile
        ? `${(profile.first_name as string) || ""} ${(profile.last_name as string) || ""}`.trim()
        : "Customer",
      customer_city: (profile?.city as string) || "",
      customer_state: (profile?.state as string) || "FL",
      agent_payout_cents: a.agent_payout_cents,
      job_price_cents: a.job_price_cents,
      platform_fee_cents: a.platform_fee_cents,
      assigned_at: a.assigned_at,
      started_at: a.started_at,
      checked_out_at: a.checked_out_at,
      verified_at: a.verified_at,
      paid_at: a.paid_at,
      completed_at: a.completed_at,
      has_box_photo: proofInfo.box,
      has_finished_photo: proofInfo.finished,
    };
  });

  // Calculate stats
  const stats = {
    pending_verification: jobs.filter((j) => j.status === "pending_verification").length,
    verified: jobs.filter((j) => j.status === "verified").length,
    paid: jobs.filter((j) => j.status === "paid").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    in_progress: jobs.filter((j) => j.status === "in_progress").length,
    assigned: jobs.filter((j) => j.status === "assigned").length,
  };

  return NextResponse.json({ jobs, stats });
}
