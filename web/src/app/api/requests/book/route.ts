import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/server";

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
    slots, // array of slot_start ISO strings
    service_type,
    details,
    total_price_cents, // Full price including add-ons, mount, etc.
    labor_price_cents, // Labor portion (agent gets 70% commission)
    materials_cost_cents, // Materials/mount cost (agent gets 100% reimbursement)
  } = body as {
    user_id?: string;
    required_minutes?: number;
    date?: string;
    slots?: string[];
    service_type?: string;
    details?: string;
    total_price_cents?: number;
    labor_price_cents?: number;
    materials_cost_cents?: number;
  };

  if (!user_id || !required_minutes || !date || !slots?.length) {
    return NextResponse.json({ error: "Missing booking parameters" }, { status: 400 });
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

  const { data: inserted, error: insertError } = await client
    .from("service_requests")
    .insert({
      user_id,
      service_type,
      preferred_date: date,
      preferred_time: slots[0],
      details,
      status: "pending",
      estimated_minutes: required_minutes,
      total_price_cents: normalizedTotalPriceCents, // Store full price with add-ons
      labor_price_cents: normalizedLaborPriceCents, // Labor portion (70% to agent)
      materials_cost_cents: normalizedMaterialsCostCents, // Materials (100% reimbursed to agent)
    })
    .select("id")
    .single();

  if (insertError) {
    // release slots if insert fails
    await client.from("available_slots").update({ is_booked: false }).in("slot_start", slots);
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, request_id: inserted?.id });
}
