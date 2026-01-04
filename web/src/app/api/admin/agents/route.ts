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

  // Pull all agent profile rows regardless of profile role (ensures pending applications still show)
  const { data: agentProfiles, error: agentError } = await adminSupabase
    .from("agent_profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (agentError) {
    return NextResponse.json({ error: agentError.message }, { status: 500 });
  }

  if (!agentProfiles || agentProfiles.length === 0) {
    return NextResponse.json({ agents: [] });
  }

  const agentIds = agentProfiles.map((a) => a.id);
  const { data: profiles, error: profilesError } = await adminSupabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone, role")
    .in("id", agentIds);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  // Merge profiles with agent profiles
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const agents = agentProfiles.map((agentData) => {
    const profile = profileMap.get(agentData.id);
    return {
      id: agentData.id,
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      status: agentData.status || "pending_approval",
      rating: agentData.rating || 5.0,
      total_jobs: agentData.total_jobs || 0,
      total_earnings_cents: agentData.total_earnings_cents || 0,
      skills: agentData.skills || [],
      stripe_payouts_enabled: agentData.stripe_payouts_enabled || false,
      identity_verification_status: agentData.identity_verification_status || "not_started",
      identity_verified_at: agentData.identity_verified_at || null,
      selfie_url: agentData.selfie_url || null,
      created_at: agentData.created_at || null,
      role: profile?.role || "client",
    };
  });

  // Sort: pending first, then by created_at
  agents.sort((a, b) => {
    if (a.status === "pending_approval" && b.status !== "pending_approval") return -1;
    if (a.status !== "pending_approval" && b.status === "pending_approval") return 1;
    return (a.created_at || "").localeCompare(b.created_at || "");
  });

  return NextResponse.json({ agents });
}
