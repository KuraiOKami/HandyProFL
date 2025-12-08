import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/server";
import { createCalendarEvent } from "@/utils/google-calendar";

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
    })
    .select("id")
    .single();

  if (insertError) {
    // release slots if insert fails
    await client.from("available_slots").update({ is_booked: false }).in("slot_start", slots);
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  // Try to create Google Calendar event (non-blocking)
  // Note: This requires an admin user to have connected their Google Calendar
  try {
    // Get admin user ID (first admin in the system)
    const { data: adminProfile } = await client
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1)
      .single();

    if (adminProfile) {
      // Get client profile for attendee email
      const { data: clientProfile } = await client
        .from("profiles")
        .select("email, first_name, last_name")
        .eq("id", user_id)
        .single();

      // Calculate event end time
      const startTime = new Date(slots[0]);
      const endTime = new Date(startTime.getTime() + required_minutes * 60 * 1000);

      const eventId = await createCalendarEvent(adminProfile.id, {
        summary: `${service_type} - ${clientProfile?.first_name || 'Client'} ${clientProfile?.last_name || ''}`.trim(),
        description: `Service Request: ${service_type}\n\nDetails:\n${details || 'No details provided'}\n\nEstimated Duration: ${required_minutes} minutes`,
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        attendeeEmail: clientProfile?.email,
      });

      // Update service request with Google Calendar event ID
      await client
        .from("service_requests")
        .update({
          google_calendar_event_id: eventId,
          synced_to_calendar: true,
        })
        .eq("id", inserted.id);

      console.log(`Created Google Calendar event: ${eventId} for request ${inserted.id}`);
    }
  } catch (calendarError) {
    // Log error but don't fail the booking
    console.error("Failed to create Google Calendar event:", calendarError);

    // Store error in service request
    await client
      .from("service_requests")
      .update({
        synced_to_calendar: false,
        calendar_sync_error: calendarError instanceof Error ? calendarError.message : 'Unknown error',
      })
      .eq("id", inserted.id);
  }

  return NextResponse.json({ ok: true, request_id: inserted?.id });
}
