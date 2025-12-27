import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { notifyAdmins } from "@/lib/adminNotifications";

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
  const {
    first_name,
    last_name,
    phone,
    bio,
    skills,
    service_area_miles,
    street,
    city,
    state,
    postal_code,
    selfie_url,
  } = body ?? {};

  if (!first_name || !last_name) {
    return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
  }

  const adminSupabase = createServiceRoleClient() ?? supabase;

  // Check if an agent profile already exists (may have been created during ID verification)
  const { data: existingAgent } = await adminSupabase
    .from("agent_profiles")
    .select("id, status, identity_verification_status, selfie_url")
    .eq("id", session.user.id)
    .maybeSingle();

  if (existingAgent?.identity_verification_status && existingAgent.identity_verification_status !== "verified") {
    return NextResponse.json({ error: "Identity verification must be completed before submitting your application." }, { status: 400 });
  }

  // Upsert the main profile so new users don't fail if their profile row doesn't exist yet
  const { error: profileError } = await adminSupabase.from("profiles").upsert(
    {
      id: session.user.id,
      first_name,
      last_name,
      phone: phone || null,
      email: session.user.email || null,
      street: street || null,
      city: city || null,
      state: state || null,
      postal_code: postal_code || null,
      role: "agent",
    },
    { onConflict: "id" }
  );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const derivedStatus =
    existingAgent?.status === "approved" || existingAgent?.status === "suspended"
      ? existingAgent.status
      : "pending_approval";

  // Insert or update the agent profile (might already exist from ID verification session creation)
  const { error: agentError } = await adminSupabase
    .from("agent_profiles")
    .upsert(
      {
        id: session.user.id,
        bio: bio || null,
        skills: skills || [],
        service_area_miles: service_area_miles || 25,
        status: derivedStatus,
        selfie_url: selfie_url || existingAgent?.selfie_url || null,
      },
      { onConflict: "id" }
    );

  if (agentError) {
    return NextResponse.json({ error: agentError.message }, { status: 500 });
  }

  const name = [first_name, last_name].filter(Boolean).join(" ") || "Agent";
  const email = session.user.email || "Not provided";
  const messageLines = [
    `New agent application: ${name}.`,
    `Email: ${email}.`,
    `Phone: ${phone || "Not provided"}.`,
    `Service area: ${service_area_miles || 25} miles.`,
  ];

  await notifyAdmins(adminSupabase, {
    subject: "New agent application",
    message: messageLines.join("\n"),
    sms: `New agent application: ${name}.`,
  });

  return NextResponse.json({ ok: true, status: "pending_approval" });
}
