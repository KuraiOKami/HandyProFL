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

// GET: Fetch single agent's full profile
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAdminSession();
  if ("error" in auth) return auth.error;
  const { adminSupabase } = auth;

  const { id: agentId } = await params;

  // Get agent profile
  const { data: agentProfile, error: agentError } = await adminSupabase
    .from("agent_profiles")
    .select("*")
    .eq("id", agentId)
    .single();

  if (agentError || !agentProfile) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Get base profile
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone, role, created_at, location_latitude, location_longitude")
    .eq("id", agentId)
    .single();

  // Get skills with service names
  const { data: skills } = await adminSupabase
    .from("agent_skills")
    .select(`
      service_id,
      proficiency_level,
      years_experience,
      certified,
      service_catalog (
        name,
        category,
        icon
      )
    `)
    .eq("agent_id", agentId);

  // Get recent jobs (job_assignments joined with service_requests)
  const { data: jobs } = await adminSupabase
    .from("job_assignments")
    .select(`
      id,
      status,
      payout_cents,
      created_at,
      completed_at,
      service_requests (
        id,
        service_type,
        preferred_date,
        preferred_time,
        status,
        total_price_cents
      )
    `)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Get recent payouts if table exists
  let payouts: { id: string; amount_cents: number; status: string; created_at: string; method: string }[] = [];
  try {
    const { data: payoutData } = await adminSupabase
      .from("agent_payouts")
      .select("id, amount_cents, status, created_at, method")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(10);
    payouts = payoutData || [];
  } catch {
    // Table might not exist yet
  }

  // Format skills with service details
  const formattedSkills = (skills || []).map((s) => {
    const catalog = Array.isArray(s.service_catalog) ? s.service_catalog[0] : s.service_catalog;
    return {
      service_id: s.service_id,
      proficiency_level: s.proficiency_level,
      years_experience: s.years_experience,
      certified: s.certified,
      service_name: catalog?.name || s.service_id,
      service_category: catalog?.category || "general",
      service_icon: catalog?.icon || "🔧",
    };
  });

  // Format jobs
  const formattedJobs = (jobs || []).map((j) => {
    const req = Array.isArray(j.service_requests) ? j.service_requests[0] : j.service_requests;
    return {
      id: j.id,
      request_id: req?.id || null,
      service_type: req?.service_type || "Unknown",
      preferred_date: req?.preferred_date || null,
      preferred_time: req?.preferred_time || null,
      request_status: req?.status || null,
      job_status: j.status,
      total_price_cents: req?.total_price_cents || 0,
      payout_cents: j.payout_cents || 0,
      created_at: j.created_at,
      completed_at: j.completed_at,
    };
  });

  return NextResponse.json({
    agent: {
      id: agentId,
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      bio: agentProfile.bio || "",
      photo_url: agentProfile.photo_url || null,
      selfie_url: agentProfile.selfie_url || null,
      status: agentProfile.status || "pending_approval",
      tier: agentProfile.tier || "bronze",
      rating: agentProfile.rating || 5.0,
      rating_count: agentProfile.rating_count || 0,
      total_jobs: agentProfile.total_jobs || 0,
      total_earnings_cents: agentProfile.total_earnings_cents || 0,
      service_area_miles: agentProfile.service_area_miles || 25,
      auto_booking_enabled: agentProfile.auto_booking_enabled || false,
      location_latitude: profile?.location_latitude || null,
      location_longitude: profile?.location_longitude || null,
      // Stripe info
      stripe_account_id: agentProfile.stripe_account_id || null,
      stripe_account_status: agentProfile.stripe_account_status || "pending",
      stripe_payouts_enabled: agentProfile.stripe_payouts_enabled || false,
      stripe_charges_enabled: agentProfile.stripe_charges_enabled || false,
      instant_payout_enabled: agentProfile.instant_payout_enabled || false,
      // Identity verification
      identity_verification_status: agentProfile.identity_verification_status || "not_started",
      identity_verified_at: agentProfile.identity_verified_at || null,
      // Admin notes
      admin_notes: agentProfile.admin_notes || "",
      // Timestamps
      created_at: profile?.created_at || agentProfile.created_at,
      updated_at: agentProfile.updated_at || null,
    },
    skills: formattedSkills,
    jobs: formattedJobs,
    payouts,
  });
}

// PUT: Update agent (admin notes, status, etc.)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAdminSession();
  if ("error" in auth) return auth.error;
  const { adminSupabase } = auth;

  const { id: agentId } = await params;
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { admin_notes } = body;

  // Update admin notes
  if (admin_notes !== undefined) {
    const { error } = await adminSupabase
      .from("agent_profiles")
      .update({ admin_notes })
      .eq("id", agentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
