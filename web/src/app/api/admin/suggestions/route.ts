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

// GET: List all service suggestions
export async function GET() {
  const auth = await getAdminSession();
  if ("error" in auth) return auth.error;
  const { adminSupabase } = auth;

  const { data: suggestions, error } = await adminSupabase
    .from("service_suggestions")
    .select(`
      id,
      suggested_name,
      suggested_category,
      description,
      why_needed,
      status,
      reviewed_at,
      review_notes,
      created_at,
      agent_id,
      profiles:agent_id (
        first_name,
        last_name,
        email
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform agent info
  const formatted = (suggestions || []).map((s) => {
    const agentProfile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    return {
      ...s,
      agent_name: agentProfile
        ? [agentProfile.first_name, agentProfile.last_name].filter(Boolean).join(" ") || agentProfile.email
        : "Unknown",
      agent_email: agentProfile?.email || null,
      profiles: undefined, // Remove raw join data
    };
  });

  return NextResponse.json({ suggestions: formatted });
}

// POST: Approve or reject a suggestion
export async function POST(req: NextRequest) {
  const auth = await getAdminSession();
  if ("error" in auth) return auth.error;
  const { adminSupabase, session } = auth;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { suggestion_id, action, review_notes, service_data } = body;

  if (!suggestion_id || !action) {
    return NextResponse.json({ error: "suggestion_id and action are required" }, { status: 400 });
  }

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  // Get the suggestion
  const { data: suggestion, error: fetchError } = await adminSupabase
    .from("service_suggestions")
    .select("*")
    .eq("id", suggestion_id)
    .single();

  if (fetchError || !suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  if (suggestion.status !== "pending") {
    return NextResponse.json({ error: "Suggestion has already been reviewed" }, { status: 400 });
  }

  // Update suggestion status
  const { error: updateError } = await adminSupabase
    .from("service_suggestions")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.user.id,
      review_notes: review_notes || null,
    })
    .eq("id", suggestion_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If approved, create the service in the catalog
  if (action === "approve") {
    // Generate ID from name if not provided
    const serviceId = service_data?.id || suggestion.suggested_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    const { error: createError } = await adminSupabase
      .from("service_catalog")
      .insert({
        id: serviceId,
        name: service_data?.name || suggestion.suggested_name,
        category: service_data?.category || suggestion.suggested_category || "general",
        description: service_data?.description || suggestion.description || null,
        icon: service_data?.icon || "🔧",
        base_minutes: service_data?.base_minutes || 60,
        price_cents: service_data?.price_cents || 9900, // Default $99
        is_active: true,
        display_order: 0,
        suggested_by: suggestion.agent_id,
      });

    if (createError) {
      // Rollback suggestion status
      await adminSupabase
        .from("service_suggestions")
        .update({ status: "pending", reviewed_at: null, reviewed_by: null, review_notes: null })
        .eq("id", suggestion_id);

      return NextResponse.json({ error: `Failed to create service: ${createError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Suggestion approved and service created",
      service_id: serviceId,
    });
  }

  return NextResponse.json({
    ok: true,
    message: "Suggestion rejected",
  });
}
