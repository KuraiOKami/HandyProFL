import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { notifyAdmins } from "@/lib/adminNotifications";
import { notifyClientBookingConfirmed, notifyClientAgentAssigned } from "@/lib/notifications";
import { processAutoBooking } from "@/lib/autoBooking";

function buildScheduleLabel(preferredDate: string | null, preferredTime: string | null) {
  if (preferredTime && preferredDate) return `${preferredDate} ${preferredTime}`;
  if (preferredTime) return preferredTime;
  if (preferredDate) return preferredDate;
  return "Not specified";
}

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
  const serviceType = (body?.service_type as string | undefined)?.trim();
  const preferredDate = (body?.preferred_date as string | undefined)?.trim() || null;
  const preferredTime = (body?.preferred_time as string | undefined)?.trim() || null;
  const details = (body?.details as string | undefined)?.trim() || null;

  if (!serviceType) {
    return NextResponse.json({ error: "service_type is required" }, { status: 400 });
  }

  const adminSupabase = createServiceRoleClient() ?? supabase;

  const { data: requestRow, error: requestError } = await adminSupabase
    .from("service_requests")
    .insert({
      user_id: session.user.id,
      service_type: serviceType,
      preferred_date: preferredDate,
      preferred_time: preferredTime,
      details,
      status: "pending",
    })
    .select("id, service_type, preferred_date, preferred_time")
    .single();

  if (requestError || !requestRow) {
    return NextResponse.json(
      { error: requestError?.message || "Failed to create request" },
      { status: 500 }
    );
  }

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("first_name, last_name, email, phone")
    .eq("id", session.user.id)
    .maybeSingle();

  const clientName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.email ||
    "Client";

  const scheduleLabel = buildScheduleLabel(preferredDate, preferredTime);
  const messageLines = [
    `New service request from ${clientName}.`,
    `Service: ${serviceType}.`,
    `Preferred: ${scheduleLabel}.`,
    `Request ID: ${requestRow.id}.`,
  ];

  const smsBody = `New request: ${serviceType} (${scheduleLabel}).`;

  await notifyAdmins(adminSupabase, {
    subject: "New service request",
    message: messageLines.join("\n"),
    sms: smsBody,
  });

  // Get service display name
  const { data: serviceData } = await adminSupabase
    .from("service_catalog")
    .select("name")
    .eq("id", serviceType)
    .single();

  const serviceName = serviceData?.name || serviceType;

  // Send booking confirmation to the client
  try {
    await notifyClientBookingConfirmed(adminSupabase, session.user.id, {
      serviceName,
      date: preferredDate || "To be scheduled",
      time: preferredTime || "",
      requestId: requestRow.id,
    });
  } catch (notifyErr) {
    console.warn("Failed to send booking confirmation:", notifyErr);
  }

  // Process auto-booking
  // Get client location for distance-based matching
  let jobLatitude: number | null = null;
  let jobLongitude: number | null = null;

  if (profile) {
    const { data: fullProfile } = await adminSupabase
      .from("profiles")
      .select("location_latitude, location_longitude")
      .eq("id", session.user.id)
      .single();

    jobLatitude = fullProfile?.location_latitude || null;
    jobLongitude = fullProfile?.location_longitude || null;
  }

  // Try auto-booking
  const autoBookResult = await processAutoBooking(
    adminSupabase,
    requestRow.id,
    serviceType,
    serviceName,
    session.user.id,
    preferredDate,
    preferredTime,
    jobLatitude,
    jobLongitude
  );

  // If auto-assigned, notify the client
  if (autoBookResult.success && autoBookResult.method === "auto_assigned" && autoBookResult.agentName) {
    try {
      await notifyClientAgentAssigned(adminSupabase, session.user.id, {
        agentName: autoBookResult.agentName,
        serviceName,
        date: preferredDate || "To be scheduled",
        requestId: requestRow.id,
      });
    } catch (notifyErr) {
      console.warn("Failed to notify client of auto-assignment:", notifyErr);
    }
  }

  return NextResponse.json({
    ok: true,
    id: requestRow.id,
    autoBooking: {
      success: autoBookResult.success,
      method: autoBookResult.method,
      agentAssigned: autoBookResult.method === "auto_assigned",
    },
  });
}
