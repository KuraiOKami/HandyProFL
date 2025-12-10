import { createClient, createServiceRoleClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

type Payload = {
  days: number[]; // 0 = Sun ... 6 = Sat
  startTime: string; // HH:MM (24h)
  endTime: string; // HH:MM (24h)
  slotMinutes?: number;
  weeks?: number;
  startDate?: string; // YYYY-MM-DD (optional)
  timeZone?: string;
};

const DEFAULT_TIME_ZONE = 'America/New_York';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const timePattern = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function toMinutes(time: string) {
  const match = time.match(timePattern);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function toTimeString(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatDateForZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function offsetForDate(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);

  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const match = tz.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
  if (!match) return '+00:00';

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  const sign = hours >= 0 ? '+' : '-';
  return `${sign}${String(Math.abs(hours)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Payload | null;
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const selectedDays = Array.isArray(body.days) ? body.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [];
  if (!selectedDays.length) {
    return NextResponse.json({ error: 'Select at least one day' }, { status: 400 });
  }

  const startMinutes = body.startTime ? toMinutes(body.startTime) : null;
  const endMinutes = body.endTime ? toMinutes(body.endTime) : null;
  if (startMinutes == null || endMinutes == null) {
    return NextResponse.json({ error: 'Invalid start/end time format. Use HH:MM (24h).' }, { status: 400 });
  }
  if (endMinutes <= startMinutes) {
    return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
  }

  const slotMinutes = Math.min(Math.max(body.slotMinutes ?? 60, 15), 240);
  const weeks = Math.min(Math.max(body.weeks ?? 2, 1), 12);
  const timeZone = body.timeZone || DEFAULT_TIME_ZONE;

  const startDate = body.startDate ? new Date(`${body.startDate}T12:00:00Z`) : new Date();
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: 'Invalid start date' }, { status: 400 });
  }
  startDate.setUTCHours(12, 0, 0, 0); // anchor mid-day to avoid TZ drift

  const adminSupabase = createServiceRoleClient() ?? supabase;
  const daysToGenerate = weeks * 7;
  const slots: Array<{ slot_start: string; slot_end: string; is_booked: boolean; source: string }> = [];

  for (let i = 0; i < daysToGenerate; i++) {
    const day = new Date(startDate);
    day.setUTCDate(startDate.getUTCDate() + i);

    const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(day);
    const weekdayIndex = dayNames.indexOf(weekday as (typeof dayNames)[number]);
    if (!selectedDays.includes(weekdayIndex)) continue;

    const dateStr = formatDateForZone(day, timeZone);
    const offset = offsetForDate(day, timeZone);

    for (let minutes = startMinutes; minutes + slotMinutes <= endMinutes; minutes += slotMinutes) {
      const startTime = toTimeString(minutes);
      const endTime = toTimeString(minutes + slotMinutes);
      slots.push({
        slot_start: `${dateStr}T${startTime}:00${offset}`,
        slot_end: `${dateStr}T${endTime}:00${offset}`,
        is_booked: false,
        source: 'manual',
      });
    }
  }

  if (!slots.length) {
    return NextResponse.json({ error: 'No slots generated for the selected days/times' }, { status: 400 });
  }

  const rangeStart = new Date(startDate);
  rangeStart.setUTCHours(0, 0, 0, 0);
  const rangeEnd = new Date(startDate);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + daysToGenerate + 1);
  rangeEnd.setUTCHours(0, 0, 0, 0);

  // Clear existing manual, unbooked slots in the range to prevent duplicates
  await adminSupabase
    .from('available_slots')
    .delete()
    .gte('slot_start', rangeStart.toISOString())
    .lt('slot_start', rangeEnd.toISOString())
    .eq('source', 'manual')
    .eq('is_booked', false);

  // Avoid inserting duplicates that may already exist from Google Calendar sync or booked slots
  const { data: existing } = await adminSupabase
    .from('available_slots')
    .select('slot_start')
    .gte('slot_start', rangeStart.toISOString())
    .lt('slot_start', rangeEnd.toISOString());

  const existingStarts = new Set((existing ?? []).map((row) => row.slot_start));
  const toInsert = slots.filter((slot) => !existingStarts.has(slot.slot_start));

  if (!toInsert.length) {
    return NextResponse.json({
      message: 'No new slots to add. Existing slots cover the selected window.',
      slotsCreated: 0,
      daysProcessed: daysToGenerate,
      timeZone,
      range: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
    });
  }

  const { error } = await adminSupabase.from('available_slots').insert(toInsert);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: 'Availability saved',
    slotsCreated: toInsert.length,
    daysProcessed: daysToGenerate,
    timeZone,
    range: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
  });
}
