import { NextRequest, NextResponse } from "next/server";
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

  return { supabase, session };
}

export async function GET() {
  const auth = await getAgentSession();
  if ("error" in auth) return auth.error;
  const { supabase, session } = auth;

  const adminSupabase = createServiceRoleClient() ?? supabase;

  // Get profile and agent profile together
  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("first_name, last_name, email, phone")
    .eq("id", session.user.id)
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { data: agentProfile, error: agentError } = await adminSupabase
    .from("agent_profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (agentError && agentError.code !== "PGRST116") {
    return NextResponse.json({ error: agentError.message }, { status: 500 });
  }

  return NextResponse.json({
    profile: {
      id: session.user.id,
      ...profile,
      ...agentProfile,
    },
  });
}

export async function PUT(req: NextRequest) {
  const auth = await getAgentSession();
  if ("error" in auth) return auth.error;
  const { supabase, session } = auth;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { first_name, last_name, phone, bio, skills, service_area_miles } = body;

  const adminSupabase = createServiceRoleClient() ?? supabase;

  // Update main profile
  if (first_name !== undefined || last_name !== undefined || phone !== undefined) {
    const profileUpdate: Record<string, unknown> = {};
    if (first_name !== undefined) profileUpdate.first_name = first_name;
    if (last_name !== undefined) profileUpdate.last_name = last_name;
    if (phone !== undefined) profileUpdate.phone = phone;

    const { error: profileError } = await adminSupabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", session.user.id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
  }

  // Update agent profile
  if (bio !== undefined || skills !== undefined || service_area_miles !== undefined) {
    const agentUpdate: Record<string, unknown> = {};
    if (bio !== undefined) agentUpdate.bio = bio;
    if (skills !== undefined) agentUpdate.skills = skills;
    if (service_area_miles !== undefined) agentUpdate.service_area_miles = service_area_miles;

    const { error: agentError } = await adminSupabase
      .from("agent_profiles")
      .update(agentUpdate)
      .eq("id", session.user.id);

    if (agentError) {
      return NextResponse.json({ error: agentError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
