import { NextResponse } from "next/server";
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

export async function GET() {
  const auth = await getAgentSession();
  if ("error" in auth) return auth.error;
  const { session, adminSupabase } = auth;

  const now = new Date();
  const agentId = session.user.id;

  // Get all earnings
  const { data: earnings, error: earningsError } = await adminSupabase
    .from("agent_earnings")
    .select(`
      id,
      assignment_id,
      amount_cents,
      status,
      available_at,
      created_at,
      job_assignments (
        completed_at,
        service_requests (
          service_type
        )
      )
    `)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (earningsError) {
    return NextResponse.json({ error: earningsError.message }, { status: 500 });
  }

  // Get payouts
  const { data: payouts, error: payoutsError } = await adminSupabase
    .from("agent_payouts")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (payoutsError) {
    return NextResponse.json({ error: payoutsError.message }, { status: 500 });
  }

  // Calculate stats
  let availableBalance = 0;
  let pendingBalance = 0;
  let totalEarnings = 0;
  let weeklyEarnings = 0;
  let monthlyEarnings = 0;
  let completedJobs = 0;

  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  (earnings || []).forEach((e) => {
    const amount = e.amount_cents;
    const availableAt = e.available_at ? new Date(e.available_at) : null;
    const createdAt = new Date(e.created_at);

    totalEarnings += amount;
    completedJobs++;

    const isAvailable = e.status === "available" && (!availableAt || availableAt <= now);

    if (e.status === "paid_out") {
      // Already paid out, don't count in balances
    } else if (isAvailable) {
      availableBalance += amount;
    } else {
      pendingBalance += amount;
    }

    if (createdAt >= weekAgo) {
      weeklyEarnings += amount;
    }
    if (createdAt >= monthAgo) {
      monthlyEarnings += amount;
    }
  });

  // Transform earnings for response
  const earningsFormatted = (earnings || []).map((e) => {
    const jaRaw = Array.isArray(e.job_assignments) ? e.job_assignments[0] : e.job_assignments;
    const ja = jaRaw as { completed_at?: string; service_requests?: { service_type?: string } | null } | null;
    const availableAt = e.available_at ? new Date(e.available_at) : null;
    const displayStatus =
      e.status === "available" && availableAt && availableAt > now ? "pending" : e.status;
    return {
      id: e.id,
      assignment_id: e.assignment_id,
      amount_cents: e.amount_cents,
      status: displayStatus,
      available_at: e.available_at,
      service_type: ja?.service_requests?.service_type || "unknown",
      completed_at: ja?.completed_at || e.created_at,
    };
  });

  return NextResponse.json({
    stats: {
      availableBalance,
      pendingBalance,
      totalEarnings,
      weeklyEarnings,
      monthlyEarnings,
      completedJobs,
    },
    earnings: earningsFormatted,
    payouts: payouts || [],
  });
}
