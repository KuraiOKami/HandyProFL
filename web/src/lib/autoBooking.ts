/**
 * Auto-Booking Engine
 *
 * Automatically assigns jobs to eligible agents based on:
 * 1. Referral priority (if client was referred by the agent)
 * 2. Agent skills matching the service type
 * 3. Agent proximity to the job location
 * 4. Agent rating and tier
 * 5. Agent availability (auto_booking_enabled and approved status)
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { notifyAgentNewGig } from "./notifications";

type AutoBookingResult = {
  success: boolean;
  agentId?: string;
  agentName?: string;
  method: "auto_assigned" | "offered" | "no_eligible_agents" | "error";
  error?: string;
};

type PricingInfo = {
  totalPriceCents: number;
  laborPriceCents: number;
  materialsCostCents: number;
};

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

type ServiceCatalogMeta = {
  id: string;
  general_skill?: string | null;
  category?: string | null;
};

function normalizeSkillKey(serviceId: string | null | undefined, meta?: ServiceCatalogMeta | null): string | null {
  if (!serviceId) return null;
  const baseFromMeta =
    (meta?.general_skill as string | null) ||
    (meta?.category as string | null);
  const inferred =
    baseFromMeta ||
    (serviceId.includes("_") ? serviceId.split("_")[0] : null) ||
    serviceId;
  const base = inferred || serviceId;
  return base.toLowerCase().replace(/\s+/g, "_");
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

type EligibleAgent = {
  id: string;
  firstName: string;
  lastName: string;
  rating: number;
  tier: string;
  distance: number | null;
  isReferrer: boolean;
  hasMatchingSkills: boolean;
  priorityScore: number;
};

// Tier multipliers for priority scoring
const TIER_MULTIPLIERS: Record<string, number> = {
  platinum: 1.4,
  gold: 1.25,
  silver: 1.1,
  bronze: 1.0,
};

// Calculate distance between two points using Haversine formula
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate priority score for an agent
function calculatePriorityScore(agent: {
  rating: number;
  tier: string;
  distance: number | null;
  serviceAreaMiles: number;
  isReferrer: boolean;
  hasMatchingSkills: boolean;
}): number {
  // Base score from rating (0-5 scale, worth up to 50 points)
  let score = agent.rating * 10;

  // Tier multiplier
  const tierMultiplier = TIER_MULTIPLIERS[agent.tier] || 1.0;
  score *= tierMultiplier;

  // Referrer bonus (massive - 100 points)
  if (agent.isReferrer) {
    score += 100;
  }

  // Skill match bonus (25 points)
  if (agent.hasMatchingSkills) {
    score += 25;
  }

  // Distance penalty (up to -25 points for agents at edge of service area)
  if (agent.distance !== null && agent.serviceAreaMiles > 0) {
    const distanceRatio = agent.distance / agent.serviceAreaMiles;
    score -= distanceRatio * 25;
  }

  return score;
}

/**
 * Find eligible agents for a service request
 */
async function findEligibleAgents(
  adminSupabase: SupabaseClient,
  serviceType: string,
  clientId: string,
  jobLatitude: number | null,
  jobLongitude: number | null
): Promise<EligibleAgent[]> {
  // Get client's referrer if any
  const { data: clientProfile } = await adminSupabase
    .from("profiles")
    .select("referred_by_agent_id")
    .eq("id", clientId)
    .single();

  const referrerAgentId = clientProfile?.referred_by_agent_id || null;

  // Get all approved agents with auto-booking enabled
  const { data: agents, error } = await adminSupabase
    .from("agent_profiles")
    .select(`
      user_id,
      bio,
      rating,
      tier,
      service_area_miles,
      auto_booking_enabled,
      status,
      profiles!agent_profiles_user_id_fkey (
        first_name,
        last_name,
        location_latitude,
        location_longitude
      )
    `)
    .eq("status", "approved")
    .eq("auto_booking_enabled", true);

  if (error || !agents) {
    console.error("Failed to fetch eligible agents:", error);
    return [];
  }

  // Get agent skills
  const agentIds = agents.map(a => a.user_id);
  const { data: agentSkillsData } = await adminSupabase
    .from("agent_skills")
    .select("agent_id, service_id")
    .in("agent_id", agentIds);

  // Fetch service metadata for skill lookups and the target service
  const skillServiceIds = Array.from(
    new Set<string>([
      serviceType,
      ...(agentSkillsData?.map((s) => s.service_id) || []),
    ])
  );

  let serviceMetaMap = new Map<string, ServiceCatalogMeta>();
  if (skillServiceIds.length > 0) {
    const { data: skillServices } = await adminSupabase
      .from("service_catalog")
      .select("id, general_skill, category")
      .in("id", skillServiceIds);

    serviceMetaMap = new Map(
      (skillServices || []).map((s) => [s.id, s as ServiceCatalogMeta])
    );
  }

  const targetSkillKey = normalizeSkillKey(serviceType, serviceMetaMap.get(serviceType) || null);

  // Build skills map
  const agentSkillsMap = new Map<string, string[]>();
  const agentSkillKeyMap = new Map<string, Set<string>>();
  for (const skill of agentSkillsData || []) {
    const existing = agentSkillsMap.get(skill.agent_id) || [];
    existing.push(skill.service_id);
    agentSkillsMap.set(skill.agent_id, existing);

    const key = normalizeSkillKey(skill.service_id, serviceMetaMap.get(skill.service_id) || null);
    if (key) {
      const existingKeys = agentSkillKeyMap.get(skill.agent_id) || new Set<string>();
      existingKeys.add(key);
      agentSkillKeyMap.set(skill.agent_id, existingKeys);
    }
  }

  // Evaluate each agent
  const eligibleAgents: EligibleAgent[] = [];

  for (const agent of agents) {
    const profile = Array.isArray(agent.profiles)
      ? agent.profiles[0]
      : agent.profiles;

    if (!profile) continue;

    const agentLat = profile.location_latitude;
    const agentLon = profile.location_longitude;
    const serviceArea = agent.service_area_miles || 25;

    // Calculate distance if both locations available
    let distance: number | null = null;
    if (jobLatitude && jobLongitude && agentLat && agentLon) {
      distance = calculateDistance(jobLatitude, jobLongitude, agentLat, agentLon);

      // Skip if agent is outside their service area
      if (distance > serviceArea) {
        continue;
      }
    }

    // Check if agent has matching skills
    const agentSkills = agentSkillsMap.get(agent.user_id) || [];
    const agentSkillKeys = agentSkillKeyMap.get(agent.user_id) || new Set<string>();
    const hasSkillKeyMatch = targetSkillKey ? agentSkillKeys.has(targetSkillKey) : false;
    const hasMatchingSkills =
      agentSkills.length === 0 || agentSkills.includes(serviceType) || hasSkillKeyMatch;

    // Skip if agent doesn't have the required skill (unless they have no skills set = accepts all)
    if (!hasMatchingSkills) {
      continue;
    }

    // Check if this agent referred the client
    const isReferrer = referrerAgentId === agent.user_id;

    // Calculate priority score
    const priorityScore = calculatePriorityScore({
      rating: agent.rating || 4.0,
      tier: agent.tier || "bronze",
      distance,
      serviceAreaMiles: serviceArea,
      isReferrer,
      hasMatchingSkills,
    });

    eligibleAgents.push({
      id: agent.user_id,
      firstName: profile.first_name || "",
      lastName: profile.last_name || "",
      rating: agent.rating || 4.0,
      tier: agent.tier || "bronze",
      distance,
      isReferrer,
      hasMatchingSkills: hasMatchingSkills || agentSkills.length === 0,
      priorityScore,
    });
  }

  // Sort by priority score (highest first)
  eligibleAgents.sort((a, b) => b.priorityScore - a.priorityScore);

  return eligibleAgents;
}

/**
 * Auto-assign or offer a job to the best eligible agent
 */
export async function processAutoBooking(
  adminSupabase: SupabaseClient,
  requestId: string,
  serviceType: string,
  serviceName: string,
  clientId: string,
  preferredDate: string | null,
  preferredTime: string | null,
  jobLatitude: number | null,
  jobLongitude: number | null,
  pricing?: PricingInfo | null
): Promise<AutoBookingResult> {
  try {
    // Find eligible agents
    const eligibleAgents = await findEligibleAgents(
      adminSupabase,
      serviceType,
      clientId,
      jobLatitude,
      jobLongitude
    );

    if (eligibleAgents.length === 0) {
      // Update request status
      await adminSupabase
        .from("service_requests")
        .update({ auto_assignment_status: "manual" })
        .eq("id", requestId);

      return {
        success: false,
        method: "no_eligible_agents",
      };
    }

    // Get the best agent (highest priority score)
    const bestAgent = eligibleAgents[0];

    // If the agent is the referrer, auto-assign directly
    if (bestAgent.isReferrer) {
      // Calculate payout based on agent tier
      const totalCents = pricing?.totalPriceCents ?? 0;
      const laborCents = pricing?.laborPriceCents ?? totalCents;
      const materialsCents = pricing?.materialsCostCents ?? 0;

      const agentPayoutCents = totalCents > 0
        ? computeAgentPayoutCents({
            totalCents,
            laborCents,
            materialsCents,
            tier: bestAgent.tier,
          })
        : 0;
      const platformFeeCents = totalCents - agentPayoutCents;

      // Create job assignment
      const { data: assignment, error: assignError } = await adminSupabase
        .from("job_assignments")
        .insert({
          request_id: requestId,
          agent_id: bestAgent.id,
          status: "assigned",
          auto_assigned: true,
          job_price_cents: totalCents,
          agent_payout_cents: agentPayoutCents,
          platform_fee_cents: platformFeeCents,
        })
        .select("id")
        .single();

      if (assignError || !assignment) {
        console.error("Failed to create auto-assignment:", assignError);
        return {
          success: false,
          method: "error",
          error: assignError?.message || "Failed to create assignment",
        };
      }

      // Update request status
      await adminSupabase
        .from("service_requests")
        .update({
          status: "assigned",
          auto_assignment_status: "accepted",
          assigned_agent_id: bestAgent.id,
        })
        .eq("id", requestId);

      // Notify the agent
      const agentName = [bestAgent.firstName, bestAgent.lastName]
        .filter(Boolean)
        .join(" ");

      try {
        await notifyAgentNewGig(adminSupabase, bestAgent.id, {
          serviceName,
          date: preferredDate || "To be scheduled",
          jobId: assignment.id,
          isAutoAssigned: true,
        });
      } catch (notifyErr) {
        console.warn("Failed to notify agent of auto-assignment:", notifyErr);
      }

      return {
        success: true,
        agentId: bestAgent.id,
        agentName,
        method: "auto_assigned",
      };
    }

    // For non-referrer agents, offer the job (they can accept/decline)
    // Update request with preferred agent and status
    await adminSupabase
      .from("service_requests")
      .update({
        preferred_agent_id: bestAgent.id,
        auto_assignment_status: "offered",
      })
      .eq("id", requestId);

    // Notify the agent about the new gig offer
    try {
      await notifyAgentNewGig(adminSupabase, bestAgent.id, {
        serviceName,
        date: preferredDate || "To be scheduled",
        jobId: requestId, // Use request ID for offers, agent will accept to create assignment
        isAutoAssigned: false,
      });
    } catch (notifyErr) {
      console.warn("Failed to notify agent of gig offer:", notifyErr);
    }

    const agentName = [bestAgent.firstName, bestAgent.lastName]
      .filter(Boolean)
      .join(" ");

    return {
      success: true,
      agentId: bestAgent.id,
      agentName,
      method: "offered",
    };
  } catch (err) {
    console.error("Auto-booking error:", err);
    return {
      success: false,
      method: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Re-process auto-booking when an agent declines or doesn't respond
 * Finds the next best agent and offers them the job
 */
export async function reprocessAutoBooking(
  adminSupabase: SupabaseClient,
  requestId: string,
  excludeAgentIds: string[]
): Promise<AutoBookingResult> {
  // Get request details
  const { data: request, error: requestError } = await adminSupabase
    .from("service_requests")
    .select(`
      id,
      service_type,
      user_id,
      preferred_date,
      preferred_time,
      profiles!service_requests_user_id_fkey (
        location_latitude,
        location_longitude
      )
    `)
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    return {
      success: false,
      method: "error",
      error: "Request not found",
    };
  }

  const profile = Array.isArray(request.profiles)
    ? request.profiles[0]
    : request.profiles;

  // Get service name
  const { data: serviceData } = await adminSupabase
    .from("service_catalog")
    .select("name")
    .eq("id", request.service_type)
    .single();

  const serviceName = serviceData?.name || request.service_type;

  // Find new eligible agents excluding those who already declined
  const eligibleAgents = await findEligibleAgents(
    adminSupabase,
    request.service_type,
    request.user_id,
    profile?.location_latitude || null,
    profile?.location_longitude || null
  );

  // Filter out excluded agents
  const remainingAgents = eligibleAgents.filter(
    (a) => !excludeAgentIds.includes(a.id)
  );

  if (remainingAgents.length === 0) {
    // No more eligible agents, mark for manual assignment
    await adminSupabase
      .from("service_requests")
      .update({
        auto_assignment_status: "manual",
        preferred_agent_id: null,
      })
      .eq("id", requestId);

    return {
      success: false,
      method: "no_eligible_agents",
    };
  }

  // Offer to next best agent
  const nextAgent = remainingAgents[0];

  await adminSupabase
    .from("service_requests")
    .update({
      preferred_agent_id: nextAgent.id,
      auto_assignment_status: "offered",
    })
    .eq("id", requestId);

  try {
    await notifyAgentNewGig(adminSupabase, nextAgent.id, {
      serviceName,
      date: request.preferred_date || "To be scheduled",
      jobId: requestId,
      isAutoAssigned: false,
    });
  } catch (notifyErr) {
    console.warn("Failed to notify next agent:", notifyErr);
  }

  const agentName = [nextAgent.firstName, nextAgent.lastName]
    .filter(Boolean)
    .join(" ");

  return {
    success: true,
    agentId: nextAgent.id,
    agentName,
    method: "offered",
  };
}
