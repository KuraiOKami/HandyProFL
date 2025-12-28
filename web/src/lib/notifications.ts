import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms, twilioConfigured } from "@/lib/twilio";
import { resendConfigured, sendEmail } from "@/lib/resend";

// Base URL for links in notifications
const getAppUrl = () => process.env.NEXT_PUBLIC_APP_URL || "https://handyprofl.netlify.app";

// ============================================
// NOTIFICATION TEMPLATES
// ============================================

export const SMS_TEMPLATES = {
  // Agent notifications
  AGENT_NEW_GIG: (serviceName: string, date: string, requestId: string) =>
    `New gig available: ${serviceName} on ${date}. View details: ${getAppUrl()}/agent?gig=${requestId}`,

  AGENT_GIG_ASSIGNED: (serviceName: string, date: string, time: string, jobId: string) =>
    `You've been assigned: ${serviceName} on ${date} at ${time}. View job: ${getAppUrl()}/agent/jobs/${jobId}`,

  AGENT_JOB_REMINDER: (serviceName: string, time: string, address: string, jobId: string) =>
    `Reminder: ${serviceName} today at ${time}. Address: ${address}. ${getAppUrl()}/agent/jobs/${jobId}`,

  AGENT_NEW_MESSAGE: (clientName: string, jobId: string) =>
    `New message from ${clientName}. Reply: ${getAppUrl()}/agent/jobs/${jobId}?tab=chat`,

  AGENT_JOB_CANCELLED: (serviceName: string, date: string) =>
    `Job cancelled: ${serviceName} on ${date}. The slot has been freed.`,

  AGENT_PAYMENT_RECEIVED: (amount: string) =>
    `Payment received: ${amount} has been deposited to your account.`,

  AGENT_NEW_RATING: (rating: number, serviceName: string) =>
    `New ${rating}-star rating for ${serviceName}. Keep up the great work!`,

  // Client notifications
  CLIENT_AGENT_ASSIGNED: (agentName: string, serviceName: string, date: string, requestId: string) =>
    `${agentName} has been assigned to your ${serviceName} on ${date}. View details: ${getAppUrl()}/requests/${requestId}`,

  CLIENT_AGENT_EN_ROUTE: (agentName: string, eta: string, requestId: string) =>
    `${agentName} is on the way! ETA: ${eta}. Track: ${getAppUrl()}/requests/${requestId}`,

  CLIENT_JOB_STARTED: (agentName: string, serviceName: string, requestId: string) =>
    `${agentName} has started your ${serviceName}. ${getAppUrl()}/requests/${requestId}`,

  CLIENT_JOB_COMPLETED: (serviceName: string, requestId: string) =>
    `Your ${serviceName} is complete! Please rate your experience: ${getAppUrl()}/requests/${requestId}?rate=true`,

  CLIENT_NEW_MESSAGE: (agentName: string, requestId: string) =>
    `New message from ${agentName}. Reply: ${getAppUrl()}/requests/${requestId}?tab=chat`,

  CLIENT_BOOKING_CONFIRMED: (serviceName: string, date: string, time: string, requestId: string) =>
    `Booking confirmed: ${serviceName} on ${date} at ${time}. ${getAppUrl()}/requests/${requestId}`,

  CLIENT_REMINDER: (serviceName: string, date: string, time: string, requestId: string) =>
    `Reminder: Your ${serviceName} is scheduled for ${date} at ${time}. ${getAppUrl()}/requests/${requestId}`,
} as const;

// ============================================
// NOTIFICATION SENDING FUNCTIONS
// ============================================

type NotificationResult = {
  sms: { sent: boolean; error?: string };
  email: { sent: boolean; error?: string };
};

type UserNotificationPrefs = {
  email_updates: boolean;
  sms_updates: boolean;
};

async function getUserPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<UserNotificationPrefs> {
  const { data } = await supabase
    .from("notification_preferences")
    .select("email_updates, sms_updates")
    .eq("user_id", userId)
    .single();

  // Default to true if no preferences set
  return {
    email_updates: data?.email_updates ?? true,
    sms_updates: data?.sms_updates ?? true,
  };
}

async function getUserContact(
  supabase: SupabaseClient,
  userId: string
): Promise<{ email: string | null; phone: string | null; first_name: string | null }> {
  const { data } = await supabase
    .from("profiles")
    .select("email, phone, first_name")
    .eq("id", userId)
    .single();

  return {
    email: data?.email || null,
    phone: data?.phone || null,
    first_name: data?.first_name || null,
  };
}

async function logNotification(
  supabase: SupabaseClient,
  userId: string,
  channel: "sms" | "email",
  template: string,
  status: "sent" | "failed",
  error?: string
) {
  try {
    await supabase.from("notifications").insert({
      user_id: userId,
      channel,
      template,
      status,
      error: error || null,
      sent_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Failed to log notification:", err);
  }
}

/**
 * Send notification to a user (respects their preferences)
 */
export async function notifyUser(
  supabase: SupabaseClient,
  userId: string,
  {
    smsBody,
    emailSubject,
    emailBody,
    templateName,
  }: {
    smsBody: string;
    emailSubject: string;
    emailBody: string;
    templateName: string;
  }
): Promise<NotificationResult> {
  const result: NotificationResult = {
    sms: { sent: false },
    email: { sent: false },
  };

  try {
    const [prefs, contact] = await Promise.all([
      getUserPreferences(supabase, userId),
      getUserContact(supabase, userId),
    ]);

    // Send SMS
    if (prefs.sms_updates && contact.phone && twilioConfigured) {
      try {
        await sendSms(contact.phone, smsBody);
        result.sms.sent = true;
        await logNotification(supabase, userId, "sms", templateName, "sent");
      } catch (err) {
        result.sms.error = err instanceof Error ? err.message : "SMS failed";
        await logNotification(supabase, userId, "sms", templateName, "failed", result.sms.error);
      }
    }

    // Send Email
    if (prefs.email_updates && contact.email && resendConfigured) {
      try {
        await sendEmail({
          to: contact.email,
          subject: emailSubject,
          text: emailBody,
        });
        result.email.sent = true;
        await logNotification(supabase, userId, "email", templateName, "sent");
      } catch (err) {
        result.email.error = err instanceof Error ? err.message : "Email failed";
        await logNotification(supabase, userId, "email", templateName, "failed", result.email.error);
      }
    }
  } catch (err) {
    console.error("notifyUser error:", err);
  }

  return result;
}

// ============================================
// HIGH-LEVEL NOTIFICATION FUNCTIONS
// ============================================

/**
 * Notify agent about a new available gig
 */
export async function notifyAgentNewGig(
  supabase: SupabaseClient,
  agentId: string,
  {
    serviceName,
    date,
    requestId,
  }: {
    serviceName: string;
    date: string;
    requestId: string;
  }
) {
  return notifyUser(supabase, agentId, {
    smsBody: SMS_TEMPLATES.AGENT_NEW_GIG(serviceName, date, requestId),
    emailSubject: `New gig available: ${serviceName}`,
    emailBody: `A new ${serviceName} job is available on ${date}.\n\nView details: ${getAppUrl()}/agent?gig=${requestId}`,
    templateName: "AGENT_NEW_GIG",
  });
}

/**
 * Notify agent they've been assigned to a job
 */
export async function notifyAgentAssigned(
  supabase: SupabaseClient,
  agentId: string,
  {
    serviceName,
    date,
    time,
    jobId,
    address,
  }: {
    serviceName: string;
    date: string;
    time: string;
    jobId: string;
    address: string;
  }
) {
  return notifyUser(supabase, agentId, {
    smsBody: SMS_TEMPLATES.AGENT_GIG_ASSIGNED(serviceName, date, time, jobId),
    emailSubject: `You've been assigned: ${serviceName}`,
    emailBody: `You've been assigned to a ${serviceName} job.\n\nDate: ${date}\nTime: ${time}\nAddress: ${address}\n\nView job details: ${getAppUrl()}/agent/jobs/${jobId}`,
    templateName: "AGENT_GIG_ASSIGNED",
  });
}

/**
 * Notify agent of job reminder
 */
export async function notifyAgentReminder(
  supabase: SupabaseClient,
  agentId: string,
  {
    serviceName,
    time,
    address,
    jobId,
  }: {
    serviceName: string;
    time: string;
    address: string;
    jobId: string;
  }
) {
  return notifyUser(supabase, agentId, {
    smsBody: SMS_TEMPLATES.AGENT_JOB_REMINDER(serviceName, time, address, jobId),
    emailSubject: `Reminder: ${serviceName} today at ${time}`,
    emailBody: `Reminder: You have a ${serviceName} job today at ${time}.\n\nAddress: ${address}\n\nView job details: ${getAppUrl()}/agent/jobs/${jobId}`,
    templateName: "AGENT_JOB_REMINDER",
  });
}

/**
 * Notify agent of new message
 */
export async function notifyAgentNewMessage(
  supabase: SupabaseClient,
  agentId: string,
  {
    clientName,
    jobId,
    messagePreview,
  }: {
    clientName: string;
    jobId: string;
    messagePreview: string;
  }
) {
  return notifyUser(supabase, agentId, {
    smsBody: SMS_TEMPLATES.AGENT_NEW_MESSAGE(clientName, jobId),
    emailSubject: `New message from ${clientName}`,
    emailBody: `You have a new message from ${clientName}:\n\n"${messagePreview}"\n\nReply: ${getAppUrl()}/agent/jobs/${jobId}?tab=chat`,
    templateName: "AGENT_NEW_MESSAGE",
  });
}

/**
 * Notify client that agent has been assigned
 */
export async function notifyClientAgentAssigned(
  supabase: SupabaseClient,
  clientId: string,
  {
    agentName,
    serviceName,
    date,
    requestId,
  }: {
    agentName: string;
    serviceName: string;
    date: string;
    requestId: string;
  }
) {
  return notifyUser(supabase, clientId, {
    smsBody: SMS_TEMPLATES.CLIENT_AGENT_ASSIGNED(agentName, serviceName, date, requestId),
    emailSubject: `${agentName} has been assigned to your ${serviceName}`,
    emailBody: `Great news! ${agentName} has been assigned to your ${serviceName} on ${date}.\n\nView details: ${getAppUrl()}/requests/${requestId}`,
    templateName: "CLIENT_AGENT_ASSIGNED",
  });
}

/**
 * Notify client that agent is en route
 */
export async function notifyClientAgentEnRoute(
  supabase: SupabaseClient,
  clientId: string,
  {
    agentName,
    eta,
    requestId,
  }: {
    agentName: string;
    eta: string;
    requestId: string;
  }
) {
  return notifyUser(supabase, clientId, {
    smsBody: SMS_TEMPLATES.CLIENT_AGENT_EN_ROUTE(agentName, eta, requestId),
    emailSubject: `${agentName} is on the way!`,
    emailBody: `${agentName} is on their way to you!\n\nEstimated arrival: ${eta}\n\nTrack progress: ${getAppUrl()}/requests/${requestId}`,
    templateName: "CLIENT_AGENT_EN_ROUTE",
  });
}

/**
 * Notify client that job has started
 */
export async function notifyClientJobStarted(
  supabase: SupabaseClient,
  clientId: string,
  {
    agentName,
    serviceName,
    requestId,
  }: {
    agentName: string;
    serviceName: string;
    requestId: string;
  }
) {
  return notifyUser(supabase, clientId, {
    smsBody: SMS_TEMPLATES.CLIENT_JOB_STARTED(agentName, serviceName, requestId),
    emailSubject: `${agentName} has started your ${serviceName}`,
    emailBody: `${agentName} has started working on your ${serviceName}.\n\nView progress: ${getAppUrl()}/requests/${requestId}`,
    templateName: "CLIENT_JOB_STARTED",
  });
}

/**
 * Notify client that job is complete
 */
export async function notifyClientJobCompleted(
  supabase: SupabaseClient,
  clientId: string,
  {
    serviceName,
    requestId,
  }: {
    serviceName: string;
    requestId: string;
  }
) {
  return notifyUser(supabase, clientId, {
    smsBody: SMS_TEMPLATES.CLIENT_JOB_COMPLETED(serviceName, requestId),
    emailSubject: `Your ${serviceName} is complete!`,
    emailBody: `Your ${serviceName} has been completed!\n\nPlease take a moment to rate your experience: ${getAppUrl()}/requests/${requestId}?rate=true\n\nThank you for using HandyProFL!`,
    templateName: "CLIENT_JOB_COMPLETED",
  });
}

/**
 * Notify client of new message
 */
export async function notifyClientNewMessage(
  supabase: SupabaseClient,
  clientId: string,
  {
    agentName,
    requestId,
    messagePreview,
  }: {
    agentName: string;
    requestId: string;
    messagePreview: string;
  }
) {
  return notifyUser(supabase, clientId, {
    smsBody: SMS_TEMPLATES.CLIENT_NEW_MESSAGE(agentName, requestId),
    emailSubject: `New message from ${agentName}`,
    emailBody: `You have a new message from ${agentName}:\n\n"${messagePreview}"\n\nReply: ${getAppUrl()}/requests/${requestId}?tab=chat`,
    templateName: "CLIENT_NEW_MESSAGE",
  });
}

/**
 * Notify client of booking confirmation
 */
export async function notifyClientBookingConfirmed(
  supabase: SupabaseClient,
  clientId: string,
  {
    serviceName,
    date,
    time,
    requestId,
  }: {
    serviceName: string;
    date: string;
    time: string;
    requestId: string;
  }
) {
  return notifyUser(supabase, clientId, {
    smsBody: SMS_TEMPLATES.CLIENT_BOOKING_CONFIRMED(serviceName, date, time, requestId),
    emailSubject: `Booking confirmed: ${serviceName}`,
    emailBody: `Your booking has been confirmed!\n\nService: ${serviceName}\nDate: ${date}\nTime: ${time}\n\nView details: ${getAppUrl()}/requests/${requestId}`,
    templateName: "CLIENT_BOOKING_CONFIRMED",
  });
}

/**
 * Notify client of upcoming appointment
 */
export async function notifyClientReminder(
  supabase: SupabaseClient,
  clientId: string,
  {
    serviceName,
    date,
    time,
    requestId,
  }: {
    serviceName: string;
    date: string;
    time: string;
    requestId: string;
  }
) {
  return notifyUser(supabase, clientId, {
    smsBody: SMS_TEMPLATES.CLIENT_REMINDER(serviceName, date, time, requestId),
    emailSubject: `Reminder: ${serviceName} on ${date}`,
    emailBody: `Reminder: Your ${serviceName} is scheduled for ${date} at ${time}.\n\nView details: ${getAppUrl()}/requests/${requestId}`,
    templateName: "CLIENT_REMINDER",
  });
}
