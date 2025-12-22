import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { sendSms, twilioConfigured } from "@/lib/twilio";

type SendBody = {
  user_id?: string;
  phone?: string;
  channel?: "sms" | "push";
  message?: string;
  title?: string;
  template?: string;
  payload?: Record<string, unknown>;
};

async function requireAdmin() {
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

  return { supabase, adminSupabase: createServiceRoleClient() ?? supabase };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { adminSupabase } = auth;

  const body = (await req.json().catch(() => null)) as SendBody | null;
  if (!body || !body.message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const channel: "sms" | "push" = body.channel || "sms";
  const userId = body.user_id;
  let phone = body.phone || "";
  let prefs: { sms_updates?: boolean; push_updates?: boolean } | null = null;

  if (userId) {
    // Pull phone + preferences for the target user
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("phone")
      .eq("id", userId)
      .maybeSingle();

    if (!phone && profile?.phone) {
      phone = profile.phone;
    }

    const { data: prefData } = await adminSupabase
      .from("notification_preferences")
      .select("sms_updates, push_updates")
      .eq("user_id", userId)
      .maybeSingle();

    prefs = prefData || null;
  }

  // Apply defaults if no preferences row exists
  const smsAllowed = prefs?.sms_updates ?? true;
  const pushAllowed = prefs?.push_updates ?? true;

  const notificationRecord = {
    user_id: userId || null,
    channel,
    template: body.template || null,
    title: body.title || null,
    body: body.message,
    payload: body.payload || null,
    status: "queued",
    error: null as string | null,
    sent_at: null as string | null,
  };

  // Push not yet implemented
  if (channel === "push") {
    const status = pushAllowed ? "queued" : "skipped";
    await adminSupabase.from("notifications").insert({
      ...notificationRecord,
      status,
      error: pushAllowed ? "push_not_implemented" : "push_opted_out",
    });
    return NextResponse.json({ status, channel });
  }

  // SMS channel
  if (!smsAllowed) {
    await adminSupabase.from("notifications").insert({
      ...notificationRecord,
      status: "skipped",
      error: "sms_opted_out",
    });
    return NextResponse.json({ status: "skipped", reason: "User disabled SMS" });
  }

  if (!phone) {
    await adminSupabase.from("notifications").insert({
      ...notificationRecord,
      status: "failed",
      error: "missing_phone",
    });
    return NextResponse.json({ error: "Recipient phone not found" }, { status: 400 });
  }

  try {
    if (!twilioConfigured) {
      throw new Error("Twilio not configured");
    }

    await sendSms(phone, body.message);

    await adminSupabase.from("notifications").insert({
      ...notificationRecord,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ status: "sent", channel });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to send SMS";
    await adminSupabase.from("notifications").insert({
      ...notificationRecord,
      status: "failed",
      error: errorMessage,
    });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
