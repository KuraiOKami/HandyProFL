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
    .select("first_name, last_name, email, phone, location_latitude, location_longitude")
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

  // Get skills from agent_skills table (new normalized structure)
  const { data: agentSkills } = await adminSupabase
    .from("agent_skills")
    .select("service_id, proficiency_level, years_experience, certified")
    .eq("agent_id", session.user.id);

  // Convert to array of service IDs for backward compatibility
  const skills = agentSkills?.map((s) => s.service_id) || [];

  return NextResponse.json({
    profile: {
      id: session.user.id,
      ...profile,
      ...agentProfile,
      skills, // Override with normalized skills
      agent_skills: agentSkills || [], // Full skill details
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

  const { first_name, last_name, phone, bio, skills, service_area_miles, location_latitude, location_longitude, auto_booking_enabled } = body;

  const adminSupabase = createServiceRoleClient() ?? supabase;

  // Update main profile
  if (first_name !== undefined || last_name !== undefined || phone !== undefined || location_latitude !== undefined || location_longitude !== undefined) {
    const profileUpdate: Record<string, unknown> = {};
    if (first_name !== undefined) profileUpdate.first_name = first_name;
    if (last_name !== undefined) profileUpdate.last_name = last_name;
    if (phone !== undefined) profileUpdate.phone = phone;
    if (location_latitude !== undefined) profileUpdate.location_latitude = location_latitude;
    if (location_longitude !== undefined) profileUpdate.location_longitude = location_longitude;

    const { error: profileError } = await adminSupabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", session.user.id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
  }

  // Update agent profile (excluding skills - handled separately)
  if (bio !== undefined || service_area_miles !== undefined || auto_booking_enabled !== undefined) {
    const agentUpdate: Record<string, unknown> = {};
    if (bio !== undefined) agentUpdate.bio = bio;
    if (service_area_miles !== undefined) agentUpdate.service_area_miles = service_area_miles;
    if (auto_booking_enabled !== undefined) agentUpdate.auto_booking_enabled = auto_booking_enabled;

    const { error: agentError } = await adminSupabase
      .from("agent_profiles")
      .update(agentUpdate)
      .eq("id", session.user.id);

    if (agentError) {
      return NextResponse.json({ error: agentError.message }, { status: 500 });
    }
  }

  // Update skills using agent_skills join table
  if (skills !== undefined && Array.isArray(skills)) {
    // Delete existing skills
    await adminSupabase
      .from("agent_skills")
      .delete()
      .eq("agent_id", session.user.id);

    // Insert new skills
    if (skills.length > 0) {
      const skillRows = skills.map((serviceId: string) => ({
        agent_id: session.user.id,
        service_id: serviceId,
      }));

      const { error: skillsError } = await adminSupabase
        .from("agent_skills")
        .insert(skillRows);

      if (skillsError) {
        return NextResponse.json({ error: skillsError.message }, { status: 500 });
      }
    }

    // Also update the legacy skills array for backward compatibility
    await adminSupabase
      .from("agent_profiles")
      .update({ skills })
      .eq("id", session.user.id);
  }

  return NextResponse.json({ ok: true });
}
