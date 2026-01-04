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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAdminSession();
  if ("error" in auth) return auth.error;
  const { adminSupabase } = auth;

  const { id: agentId } = await params;

  if (!agentId) {
    return NextResponse.json({ error: "Agent ID required" }, { status: 400 });
  }

  // Verify the user is an agent
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("role")
    .eq("id", agentId)
    .single();

  if (!profile || profile.role !== "agent") {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Update agent status to suspended
  const { error } = await adminSupabase
    .from("agent_profiles")
    .update({ status: "suspended" })
    .eq("id", agentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "suspended" });
}
