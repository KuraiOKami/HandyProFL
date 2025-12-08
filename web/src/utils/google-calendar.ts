/**
 * Google Calendar API Integration Utility
 * Handles OAuth, availability sync, and event creation
 */

import { google, calendar_v3 } from 'googleapis';
import { createClient } from '@/utils/supabase/server';

export interface CalendarCredentials {
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  calendar_id: string;
}

export interface AvailabilitySlot {
  slot_start: string; // ISO 8601 timestamp
  slot_end: string;   // ISO 8601 timestamp
  is_booked: boolean;
  source: 'manual' | 'google_calendar';
  google_calendar_event_id?: string;
}

/**
 * Creates an authenticated Google Calendar API client
 */
export async function getCalendarClient(userId: string) {
  const supabase = await createClient();

  // Fetch credentials from database
  const { data: creds, error } = await supabase
    .from('google_calendar_credentials')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !creds) {
    throw new Error('Google Calendar credentials not found. Please connect your calendar first.');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: creds.access_token,
    refresh_token: creds.refresh_token,
    expiry_date: new Date(creds.token_expiry).getTime(),
  });

  // Auto-refresh token if expired
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token && tokens.expiry_date) {
      await supabase
        .from('google_calendar_credentials')
        .update({
          access_token: tokens.access_token,
          token_expiry: new Date(tokens.expiry_date).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }
  });

  return {
    calendar: google.calendar({ version: 'v3', auth: oauth2Client }),
    calendarId: creds.calendar_id,
  };
}

/**
 * Fetches busy times from Google Calendar for a date range
 */
export async function fetchBusyTimes(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ start: string; end: string }>> {
  const { calendar, calendarId } = await getCalendarClient(userId);

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      items: [{ id: calendarId }],
      timeZone: 'America/New_York',
    },
  });

  const busySlots = response.data.calendars?.[calendarId]?.busy || [];

  return busySlots.map(slot => ({
    start: slot.start!,
    end: slot.end!,
  }));
}

/**
 * Generates available slots by excluding busy times
 * Default business hours: 9 AM - 7 PM ET, 30-minute slots
 */
export async function generateAvailableSlots(
  userId: string,
  startDate: Date,
  endDate: Date,
  slotDurationMinutes: number = 30,
  businessHoursStart: number = 9,
  businessHoursEnd: number = 19
): Promise<AvailabilitySlot[]> {
  const busyTimes = await fetchBusyTimes(userId, startDate, endDate);
  const slots: AvailabilitySlot[] = [];

  // Iterate through each day
  const currentDate = new Date(startDate);
  while (currentDate < endDate) {
    // Skip weekends (optional - remove this if you work weekends)
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Generate slots for business hours
    for (let hour = businessHoursStart; hour < businessHoursEnd; hour++) {
      for (let minute = 0; minute < 60; minute += slotDurationMinutes) {
        const slotStart = new Date(currentDate);
        slotStart.setHours(hour, minute, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + slotDurationMinutes);

        // Stop if slot goes beyond business hours
        if (slotEnd.getHours() > businessHoursEnd) {
          break;
        }

        // Check if slot overlaps with busy time
        const isBooked = busyTimes.some(busy => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return (
            (slotStart >= busyStart && slotStart < busyEnd) ||
            (slotEnd > busyStart && slotEnd <= busyEnd) ||
            (slotStart <= busyStart && slotEnd >= busyEnd)
          );
        });

        slots.push({
          slot_start: slotStart.toISOString(),
          slot_end: slotEnd.toISOString(),
          is_booked: isBooked,
          source: 'google_calendar',
        });
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
}

/**
 * Syncs available slots to the database
 */
export async function syncSlotsToDatabase(
  slots: AvailabilitySlot[],
  startDate: Date,
  endDate: Date
): Promise<{ created: number; updated: number; deleted: number }> {
  const supabase = await createClient();
  let created = 0;
  let updated = 0;
  let deleted = 0;

  try {
    // Delete existing Google Calendar slots in the date range
    const { error: deleteError } = await supabase
      .from('available_slots')
      .delete()
      .eq('source', 'google_calendar')
      .gte('slot_start', startDate.toISOString())
      .lte('slot_start', endDate.toISOString());

    if (deleteError) throw deleteError;

    // Insert new slots
    if (slots.length > 0) {
      const { data, error: insertError } = await supabase
        .from('available_slots')
        .insert(
          slots.map(slot => ({
            slot_start: slot.slot_start,
            slot_end: slot.slot_end,
            is_booked: slot.is_booked,
            source: slot.source,
            google_calendar_event_id: slot.google_calendar_event_id,
            last_synced_at: new Date().toISOString(),
          }))
        )
        .select();

      if (insertError) throw insertError;
      created = data?.length || 0;
    }

    // Log sync activity
    await supabase.from('calendar_sync_log').insert({
      sync_start_date: startDate.toISOString().split('T')[0],
      sync_end_date: endDate.toISOString().split('T')[0],
      slots_created: created,
      slots_updated: updated,
      slots_deleted: deleted,
      status: 'success',
    });

    return { created, updated, deleted };
  } catch (error) {
    // Log failed sync
    await supabase.from('calendar_sync_log').insert({
      sync_start_date: startDate.toISOString().split('T')[0],
      sync_end_date: endDate.toISOString().split('T')[0],
      slots_created: 0,
      slots_updated: 0,
      slots_deleted: 0,
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

/**
 * Creates an event in Google Calendar
 */
export async function createCalendarEvent(
  userId: string,
  event: {
    summary: string;
    description?: string;
    start: string; // ISO 8601
    end: string;   // ISO 8601
    attendeeEmail?: string;
  }
): Promise<string> {
  const { calendar, calendarId } = await getCalendarClient(userId);

  const response = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: event.summary,
      description: event.description,
      start: {
        dateTime: event.start,
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: event.end,
        timeZone: 'America/New_York',
      },
      attendees: event.attendeeEmail ? [{ email: event.attendeeEmail }] : [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 60 },      // 1 hour before
        ],
      },
    },
  });

  if (!response.data.id) {
    throw new Error('Failed to create calendar event');
  }

  return response.data.id;
}

/**
 * Updates an existing calendar event
 */
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  updates: {
    summary?: string;
    description?: string;
    start?: string;
    end?: string;
  }
): Promise<void> {
  const { calendar, calendarId } = await getCalendarClient(userId);

  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: {
      summary: updates.summary,
      description: updates.description,
      start: updates.start ? {
        dateTime: updates.start,
        timeZone: 'America/New_York',
      } : undefined,
      end: updates.end ? {
        dateTime: updates.end,
        timeZone: 'America/New_York',
      } : undefined,
    },
  });
}

/**
 * Deletes a calendar event
 */
export async function deleteCalendarEvent(
  userId: string,
  eventId: string
): Promise<void> {
  const { calendar, calendarId } = await getCalendarClient(userId);
  await calendar.events.delete({
    calendarId,
    eventId,
  });
}

/**
 * Gets the OAuth URL for user authorization
 */
export function getAuthorizationUrl(): string {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    prompt: 'consent', // Force consent screen to get refresh token
  });
}

/**
 * Exchanges authorization code for tokens and stores in database
 */
export async function handleOAuthCallback(
  code: string,
  userId: string
): Promise<void> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error('Failed to obtain OAuth tokens');
  }

  oauth2Client.setCredentials(tokens);

  // Get primary calendar ID
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const calendarList = await calendar.calendarList.list();
  const primaryCalendar = calendarList.data.items?.find(cal => cal.primary);

  if (!primaryCalendar?.id) {
    throw new Error('Could not find primary calendar');
  }

  // Store credentials in database
  const supabase = await createClient();
  const { error } = await supabase
    .from('google_calendar_credentials')
    .upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: new Date(tokens.expiry_date).toISOString(),
      calendar_id: primaryCalendar.id,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
}
