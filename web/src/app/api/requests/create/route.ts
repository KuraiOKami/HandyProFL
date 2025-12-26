import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { notifyAdmins } from "@/lib/adminNotifications";

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

  return NextResponse.json({ ok: true, id: requestRow.id });
}
