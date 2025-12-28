import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/server";
import { processAutoBooking } from "@/lib/autoBooking";
import { notifyClientAgentAssigned, notifyClientBookingConfirmed } from "@/lib/notifications";

// Atomically reserve slots and insert a request
export async function POST(req: NextRequest) {
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const {
    user_id,
    required_minutes,
    date,
    slots, // array of slot_start ISO strings (optional now - for gig-based flow)
    preferred_time, // ISO string for preferred time (gig-based flow)
    service_type,
    details,
    total_price_cents, // Full price including add-ons, mount, etc.
    labor_price_cents, // Labor portion (agent gets 70% commission)
    materials_cost_cents, // Materials/mount cost (agent gets 100% reimbursement)
    payment_method_id, // Stripe payment method ID (charge on confirmation)
  } = body as {
    user_id?: string;
    required_minutes?: number;
    date?: string;
    slots?: string[];
    preferred_time?: string;
    service_type?: string;
    details?: string;
    total_price_cents?: number;
    labor_price_cents?: number;
    materials_cost_cents?: number;
    payment_method_id?: string;
  };

  // Either slots (old flow) or preferred_time (new gig-based flow)
  const hasSlots = slots && slots.length > 0;
  const hasPreferredTime = !!preferred_time;

  if (!user_id || !required_minutes || !date) {
    return NextResponse.json({ error: "Missing booking parameters" }, { status: 400 });
  }

  if (!hasSlots && !hasPreferredTime) {
    return NextResponse.json({ error: "Either slots or preferred_time required" }, { status: 400 });
  }

  const normalizedTotalPriceCents =
    typeof total_price_cents === "number" && Number.isFinite(total_price_cents)
      ? Math.max(0, Math.round(total_price_cents))
      : null;
  const normalizedLaborPriceCents =
    typeof labor_price_cents === "number" && Number.isFinite(labor_price_cents)
      ? Math.max(0, Math.round(labor_price_cents))
      : null;
  const normalizedMaterialsCostCents =
    typeof materials_cost_cents === "number" && Number.isFinite(materials_cost_cents)
      ? Math.max(0, Math.round(materials_cost_cents))
      : null;

  const client = supabase;

  // Only reserve slots if using the old slot-based flow
  if (hasSlots) {
    // Reserve slots atomically
    const { error: reserveError } = await client
      .from("available_slots")
      .update({ is_booked: true })
      .in("slot_start", slots)
      .eq("is_booked", false);

    if (reserveError) {
      return NextResponse.json({ error: reserveError.message }, { status: 400 });
    }

    // Verify all slots were reserved
    const { data: reserved } = await client.from("available_slots").select("slot_start").in("slot_start", slots);
    if (!reserved || reserved.length !== slots.length) {
      // release any partial reservation
      await client.from("available_slots").update({ is_booked: false }).in("slot_start", slots);
      return NextResponse.json({ error: "Slots unavailable" }, { status: 409 });
    }
  }

  // Determine the preferred time to store
  const storedPreferredTime = hasSlots ? slots[0] : preferred_time;

  const { data: inserted, error: insertError } = await client
    .from("service_requests")
    .insert({
      user_id,
      service_type,
      preferred_date: date,
      preferred_time: storedPreferredTime,
      details,
      status: "pending",
      estimated_minutes: required_minutes,
      total_price_cents: normalizedTotalPriceCents,
      labor_price_cents: normalizedLaborPriceCents,
      materials_cost_cents: normalizedMaterialsCostCents,
      payment_method_id: payment_method_id || null, // Store for charging on confirmation
    })
    .select("id")
    .single();

  if (insertError) {
    // release slots if insert fails (only if we reserved them)
    if (hasSlots) {
      await client.from("available_slots").update({ is_booked: false }).in("slot_start", slots);
    }
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  const requestId = inserted?.id;

  // Get service name for notifications
  let serviceName = service_type || "Service";
  if (service_type) {
    const { data: catalogEntry } = await client
      .from("service_catalog")
      .select("name")
      .eq("id", service_type)
      .maybeSingle();
    if (catalogEntry?.name) {
      serviceName = catalogEntry.name;
    }
  }

  // Get client location for distance-based matching
  let jobLatitude: number | null = null;
  let jobLongitude: number | null = null;

  const { data: profile } = await client
    .from("profiles")
    .select("location_latitude, location_longitude")
    .eq("id", user_id)
    .single();

  if (profile) {
    jobLatitude = profile.location_latitude || null;
    jobLongitude = profile.location_longitude || null;
  }

  // Send booking confirmation to client
  try {
    await notifyClientBookingConfirmed(client, user_id, {
      serviceName,
      date: date || "To be scheduled",
      time: storedPreferredTime || "",
      requestId,
    });
  } catch (notifyErr) {
    console.warn("Failed to send booking confirmation:", notifyErr);
  }

  // Try auto-booking
  const autoBookResult = await processAutoBooking(
    client,
    requestId,
    service_type || "",
    serviceName,
    user_id,
    date || null,
    storedPreferredTime || null,
    jobLatitude,
    jobLongitude,
    normalizedTotalPriceCents !== null
      ? {
          totalPriceCents: normalizedTotalPriceCents,
          laborPriceCents: normalizedLaborPriceCents ?? normalizedTotalPriceCents,
          materialsCostCents: normalizedMaterialsCostCents ?? 0,
        }
      : null
  );

  // If auto-assigned, notify the client
  if (autoBookResult.success && autoBookResult.method === "auto_assigned" && autoBookResult.agentName) {
    try {
      await notifyClientAgentAssigned(client, user_id, {
        agentName: autoBookResult.agentName,
        serviceName,
        date: date || "To be scheduled",
        requestId,
      });
    } catch (notifyErr) {
      console.warn("Failed to notify client of auto-assignment:", notifyErr);
    }
  }

  return NextResponse.json({
    ok: true,
    request_id: requestId,
    auto_booking: autoBookResult,
  });
}
