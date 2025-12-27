import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/utils/supabase/server";
import { sendSms, twilioConfigured } from "@/lib/twilio";
import { resendConfigured, sendEmail } from "@/lib/resend";

type AdminContact = {
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
};

type AdminNotification = {
  subject: string;
  message: string;
  sms?: string;
};

const parseList = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const dedupe = (values: string[]) => Array.from(new Set(values));

async function loadAdminContacts(adminSupabase?: SupabaseClient) {
  const client = adminSupabase ?? createServiceRoleClient();
  if (!client) return null;

  const { data, error } = await client
    .from("profiles")
    .select("email, phone, first_name, last_name")
    .eq("role", "admin");

  if (error) {
    console.warn("Failed to load admin contacts:", error.message);
    return null;
  }

  return (data ?? []) as AdminContact[];
}

export async function notifyAdmins(
  adminSupabase: SupabaseClient | null,
  { subject, message, sms }: AdminNotification
) {
  const overrideEmails = parseList(process.env.ADMIN_NOTIFICATION_EMAILS);
  const overridePhones = parseList(process.env.ADMIN_NOTIFICATION_PHONES);

  let emails = overrideEmails;
  let phones = overridePhones;

  if (!emails.length || !phones.length) {
    const contacts = await loadAdminContacts(adminSupabase ?? undefined);
    if (contacts) {
      if (!emails.length) {
        emails = dedupe(
          contacts.map((contact) => contact.email).filter(Boolean) as string[]
        );
      }
      if (!phones.length) {
        phones = dedupe(
          contacts.map((contact) => contact.phone).filter(Boolean) as string[]
        );
      }
    }
  }

  const smsBody = (sms || message).trim();

  if (resendConfigured && emails.length) {
    try {
      await sendEmail({ to: emails, subject, text: message });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Email send failed";
      console.warn("Admin email notification failed:", errorMessage);
    }
  } else if (!resendConfigured && emails.length) {
    console.warn("Resend not configured; skipping admin email notification.");
  }

  if (twilioConfigured && phones.length && smsBody) {
    try {
      await Promise.all(phones.map((phone) => sendSms(phone, smsBody)));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "SMS send failed";
      console.warn("Admin SMS notification failed:", errorMessage);
    }
  } else if (!twilioConfigured && phones.length) {
    console.warn("Twilio not configured; skipping admin SMS notification.");
  }
}
