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

  return { supabase, session, adminSupabase: createServiceRoleClient() ?? supabase };
}

// GET: List agent's suggestions
export async function GET() {
  const auth = await getAgentSession();
  if ("error" in auth) return auth.error;
  const { session, adminSupabase } = auth;

  const { data: suggestions, error } = await adminSupabase
    .from("service_suggestions")
    .select("id, suggested_name, suggested_category, description, why_needed, status, reviewed_at, review_notes, created_at")
    .eq("agent_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ suggestions: suggestions || [] });
}

// POST: Submit a new service suggestion
export async function POST(req: NextRequest) {
  const auth = await getAgentSession();
  if ("error" in auth) return auth.error;
  const { session, adminSupabase } = auth;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, category, description, why_needed } = body;

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Service name is required (min 2 characters)" }, { status: 400 });
  }

  // Check for duplicate suggestions from this agent
  const { data: existing } = await adminSupabase
    .from("service_suggestions")
    .select("id")
    .eq("agent_id", session.user.id)
    .ilike("suggested_name", name.trim())
    .single();

  if (existing) {
    return NextResponse.json({ error: "You've already suggested this service" }, { status: 409 });
  }

  // Check if service already exists in catalog
  const { data: existingService } = await adminSupabase
    .from("service_catalog")
    .select("id, name")
    .ilike("name", name.trim())
    .single();

  if (existingService) {
    return NextResponse.json({
      error: `Service "${existingService.name}" already exists in the catalog`,
      existing_id: existingService.id
    }, { status: 409 });
  }

  const { data: suggestion, error } = await adminSupabase
    .from("service_suggestions")
    .insert({
      agent_id: session.user.id,
      suggested_name: name.trim(),
      suggested_category: category?.trim() || null,
      description: description?.trim() || null,
      why_needed: why_needed?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    suggestion_id: suggestion?.id,
    message: "Thank you! Your suggestion has been submitted for review."
  });
}
