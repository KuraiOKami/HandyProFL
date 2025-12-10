import { NextResponse } from "next/server";
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

export async function GET() {
  const auth = await getAdminSession();
  if ("error" in auth) return auth.error;
  const { adminSupabase } = auth;

  // Get all agents (users with role='agent')
  const { data: profiles, error: profilesError } = await adminSupabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone")
    .eq("role", "agent");

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ agents: [] });
  }

  // Get agent profiles
  const agentIds = profiles.map((p) => p.id);
  const { data: agentProfiles, error: agentError } = await adminSupabase
    .from("agent_profiles")
    .select("*")
    .in("id", agentIds);

  if (agentError) {
    return NextResponse.json({ error: agentError.message }, { status: 500 });
  }

  // Merge profiles with agent profiles
  const agentProfileMap = new Map(agentProfiles?.map((a) => [a.id, a]) || []);

  const agents = profiles.map((p) => {
    const agentData = agentProfileMap.get(p.id);
    return {
      id: p.id,
      first_name: p.first_name || "",
      last_name: p.last_name || "",
      email: p.email || "",
      phone: p.phone || "",
      status: agentData?.status || "pending_approval",
      rating: agentData?.rating || 5.0,
      total_jobs: agentData?.total_jobs || 0,
      total_earnings_cents: agentData?.total_earnings_cents || 0,
      skills: agentData?.skills || [],
      stripe_payouts_enabled: agentData?.stripe_payouts_enabled || false,
      created_at: agentData?.created_at || null,
    };
  });

  // Sort: pending first, then by created_at
  agents.sort((a, b) => {
    if (a.status === "pending_approval" && b.status !== "pending_approval") return -1;
    if (a.status !== "pending_approval" && b.status === "pending_approval") return 1;
    return 0;
  });

  return NextResponse.json({ agents });
}
