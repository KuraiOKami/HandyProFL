import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { first_name, last_name, phone, bio, skills, service_area_miles } = body ?? {};

  if (!first_name || !last_name) {
    return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
  }

  const adminSupabase = createServiceRoleClient() ?? supabase;

  // Check if already an agent
  const { data: existingAgent } = await adminSupabase
    .from("agent_profiles")
    .select("id")
    .eq("id", session.user.id)
    .single();

  if (existingAgent) {
    return NextResponse.json({ error: "Agent profile already exists" }, { status: 409 });
  }

  // Update the main profile
  const { error: profileError } = await adminSupabase
    .from("profiles")
    .update({
      first_name,
      last_name,
      phone: phone || null,
      role: "agent",
    })
    .eq("id", session.user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Create agent profile
  const { error: agentError } = await adminSupabase
    .from("agent_profiles")
    .insert({
      id: session.user.id,
      bio: bio || null,
      skills: skills || [],
      service_area_miles: service_area_miles || 25,
      status: "pending_approval",
    });

  if (agentError) {
    // Rollback role change
    await adminSupabase
      .from("profiles")
      .update({ role: "client" })
      .eq("id", session.user.id);

    return NextResponse.json({ error: agentError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "pending_approval" });
}
