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
  } = body as {
    user_id?: string;
    required_minutes?: number;
    date?: string;
    slots?: string[];
    service_type?: string;
    details?: string;
  };

  if (!user_id || !required_minutes || !date || !slots?.length) {
    return NextResponse.json({ error: "Missing booking parameters" }, { status: 400 });
  }

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

  const { error: insertError } = await client.from("service_requests").insert({
    user_id,
    service_type,
    preferred_date: date,
    preferred_time: slots[0],
    details,
    status: "pending",
    estimated_minutes: required_minutes,
  });

  if (insertError) {
    // release slots if insert fails
    await client.from("available_slots").update({ is_booked: false }).in("slot_start", slots);
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
