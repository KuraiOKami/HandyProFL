import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { sanitizeDetailsForAgent } from "@/lib/formatting";
import { errorResponse } from "@/lib/api-errors";

// Agent payout policy (tier-based):
// - Labor: Bronze 50%, Silver 55%, Gold 60%, Platinum 70%
// - 100% of materials (reimbursed/pass-through)
// - 50% of any additional surcharge (e.g., urgency/priority fee)
const TIER_PAYOUT_PERCENTAGES: Record<string, number> = {
  bronze: 0.50,
  silver: 0.55,
  gold: 0.60,
  platinum: 0.70,
};
const SURCHARGE_PAYOUT_PERCENTAGE = 0.5;
const DEFAULT_RATE_PER_MINUTE_CENTS = 150; // $90/hr fallback

function normalizeCents(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

function computeAgentPayoutCents(args: {
  totalCents: number;
  laborCents: number;
  materialsCents: number;
  tier: string;
}) {
  const laborPayoutPercentage = TIER_PAYOUT_PERCENTAGES[args.tier] || TIER_PAYOUT_PERCENTAGES.bronze;
  const surchargeCents = Math.max(0, args.totalCents - args.laborCents - args.materialsCents);
  const laborPayoutCents = Math.round(args.laborCents * laborPayoutPercentage);
  const surchargePayoutCents = Math.round(surchargeCents * SURCHARGE_PAYOUT_PERCENTAGE);
  const payoutCents = laborPayoutCents + args.materialsCents + surchargePayoutCents;
  return Math.min(args.totalCents, Math.max(1, payoutCents));
}

// Haversine formula to calculate distance in miles between two coordinates
function haversineDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getApprovedAgentSession() {
  const supabase = await createClient();
  if (!supabase) {
    return { error: errorResponse("service.unconfigured", "Supabase not configured", 500) };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: errorResponse("auth.missing", "Unauthorized", 401) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "agent") {
    return { error: errorResponse("auth.not_agent", "Agent access required", 403) };
  }

  // Check if agent is approved and get agent details
  const adminSupabase = createServiceRoleClient() ?? supabase;
  const { data: agentProfile } = await adminSupabase
    .from("agent_profiles")
    .select("status, skills, service_area_miles, tier")
    .eq("id", session.user.id)
    .single();

  if (agentProfile?.status !== "approved") {
    return { error: errorResponse("auth.forbidden", "Agent approval required to view gigs", 403) };
  }

  // Get agent's location from profiles table
  const { data: agentUserProfile } = await adminSupabase
    .from("profiles")
    .select("location_latitude, location_longitude")
    .eq("id", session.user.id)
    .single();

  return {
    supabase,
    session,
    adminSupabase,
    agentSkills: (agentProfile.skills as string[]) || [],
    serviceAreaMiles: agentProfile.service_area_miles || 25,
    agentTier: (agentProfile.tier as string) || "bronze",
    agentLocation: {
      latitude: agentUserProfile?.location_latitude as number | null,
      longitude: agentUserProfile?.location_longitude as number | null,
    },
  };
}

export async function GET() {
  const auth = await getApprovedAgentSession();
  if ("error" in auth) return auth.error;
  const { adminSupabase, agentSkills, serviceAreaMiles, agentTier, agentLocation } = auth;

  // Get unassigned, confirmed requests
  const { data: requests, error } = await adminSupabase
    .from("service_requests")
    .select(`
      id,
      service_type,
      preferred_date,
      preferred_time,
      estimated_minutes,
      details,
      status,
      user_id,
      job_latitude,
      job_longitude,
      total_price_cents,
      labor_price_cents,
      materials_cost_cents,
      profiles:user_id (
        city,
        state,
        client_rating,
        client_rating_count
      )
    `)
    .in("status", ["pending", "confirmed"])
    .is("assigned_agent_id", null)
    .order("preferred_date", { ascending: true })
    .order("preferred_time", { ascending: true });

  if (error) {
    return errorResponse("internal.error", error.message, 500);
  }

  // Get service catalog for pricing
  const { data: catalog } = await adminSupabase
    .from("service_catalog")
    .select("id, price_cents, base_minutes");

  const catalogMap = new Map(catalog?.map((s) => [s.id, s]) || []);

  // Transform requests to gigs with payout info
  // NOTE: Only expose general location (city/state) before agent accepts the gig
  // Full address, client name, and phone are only available after accepting
  const gigs = (requests || [])
    .map((req) => {
      const profileRaw = Array.isArray(req.profiles) ? req.profiles[0] : req.profiles;
      const profile = profileRaw as {
        city?: string;
        state?: string;
        client_rating?: number | null;
        client_rating_count?: number | null;
      } | null;
      const catalogEntry = catalogMap.get(req.service_type);
      const estimatedMinutes = req.estimated_minutes || catalogEntry?.base_minutes || 60;

      const storedTotalCents = normalizeCents((req as { total_price_cents?: number | null }).total_price_cents);
      const storedLaborCents = normalizeCents((req as { labor_price_cents?: number | null }).labor_price_cents);
      const storedMaterialsCents =
        normalizeCents((req as { materials_cost_cents?: number | null }).materials_cost_cents) ?? 0;

      // Determine commissioned labor vs surcharge so agents can be reimbursed for materials
      // and fairly share in any urgency/priority fees.
      const baseLaborCents =
        storedLaborCents ??
        catalogEntry?.price_cents ??
        Math.round(estimatedMinutes * DEFAULT_RATE_PER_MINUTE_CENTS);
      const totalCents = storedTotalCents ?? baseLaborCents + storedMaterialsCents;
      const agentPayoutCents = computeAgentPayoutCents({
        totalCents,
        laborCents: baseLaborCents,
        materialsCents: storedMaterialsCents,
        tier: agentTier,
      });

      // Calculate distance from agent if both locations are available
      let distanceMiles: number | null = null;
      if (
        agentLocation.latitude &&
        agentLocation.longitude &&
        req.job_latitude &&
        req.job_longitude
      ) {
        distanceMiles = haversineDistanceMiles(
          agentLocation.latitude,
          agentLocation.longitude,
          req.job_latitude,
          req.job_longitude
        );
      }

      return {
        id: req.id,
        service_type: req.service_type,
        preferred_date: req.preferred_date,
        preferred_time: req.preferred_time,
        estimated_minutes: estimatedMinutes,
        details: sanitizeDetailsForAgent(req.details),
        // Only general area - no street address or zip before accepting
        city: profile?.city || "Unknown",
        state: profile?.state || "FL",
        // Only agent payout - don't expose total job price
        agent_payout_cents: agentPayoutCents,
        has_location: !!(req.job_latitude && req.job_longitude),
        // Client rating (helps agents decide)
        client_rating: profile?.client_rating || null,
        client_rating_count: profile?.client_rating_count || 0,
        // Distance info
        distance_miles: distanceMiles ? Math.round(distanceMiles * 10) / 10 : null,
      };
    })
    // Filter by skills: only show gigs that match agent's skills
    .filter((gig) => {
      // If agent has no skills set, show all gigs
      if (agentSkills.length === 0) return true;
      // Check if the gig's service type matches any of the agent's skills
      return agentSkills.includes(gig.service_type);
    })
    // Filter by distance: only show gigs within service area (if agent has location set)
    .filter((gig) => {
      // If agent has no location set, show all gigs
      if (!agentLocation.latitude || !agentLocation.longitude) return true;
      // If gig has no location, include it (agent can decide)
      if (gig.distance_miles === null) return true;
      // Only show gigs within the agent's service area
      return gig.distance_miles <= serviceAreaMiles;
    });

  // Also return filter info so the frontend can display it
  return NextResponse.json({
    gigs,
    filters: {
      skills: agentSkills,
      service_area_miles: serviceAreaMiles,
      has_location: !!(agentLocation.latitude && agentLocation.longitude),
    },
  });
}
