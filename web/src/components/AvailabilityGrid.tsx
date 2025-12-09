'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/browser';

interface TimeSlot {
  id: string;
  slot_start: string;
  slot_end: string;
  is_booked: boolean;
  source: string;
}

interface DaySlots {
  day: string;
  date: string;
  fullDate: string;
  slots: Array<{
    time: string;
    startIso: string;
    endIso: string;
    isBooked: boolean;
  }>;
}

export default function AvailabilityGrid() {
  const [selected, setSelected] = useState<string | null>(null);
  const [availability, setAvailability] = useState<DaySlots[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAvailability = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      if (!supabase) {
        setError('Configuration error. Please try again later.');
        return;
      }

      // Get next 7 days of slots
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 7);

      const { data: slots, error: fetchError } = await supabase
        .from('available_slots')
        .select('*')
        .gte('slot_start', today.toISOString())
        .lt('slot_start', endDate.toISOString())
        .order('slot_start', { ascending: true });

      if (fetchError) throw fetchError;

      if (!slots || slots.length === 0) {
        setError('No availability found. Admin needs to sync Google Calendar or add slots manually.');
        setAvailability([]);
        return;
      }

      // Group slots by day
      const grouped = groupSlotsByDay(slots as TimeSlot[]);
      setAvailability(grouped);
    } catch (err) {
      console.error('Error loading availability:', err);
      setError('Failed to load availability');
    } finally {
      setLoading(false);
    }
  }, [groupSlotsByDay]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  const groupSlotsByDay = useCallback((slots: TimeSlot[]): DaySlots[] => {
    const dayMap = new Map<string, DaySlots>();

    slots.forEach((slot) => {
      const slotDate = new Date(slot.slot_start);
      const dateKey = slotDate.toISOString().split('T')[0];

      if (!dayMap.has(dateKey)) {
        const dayLabel = getDayLabel(slotDate);
        const dateLabel = slotDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });

        dayMap.set(dateKey, {
          day: dayLabel,
          date: dateLabel,
          fullDate: dateKey,
          slots: [],
        });
      }

      const day = dayMap.get(dateKey)!;
      day.slots.push({
        time: slotDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/New_York',
        }),
        startIso: slot.slot_start,
        endIso: slot.slot_end,
        isBooked: slot.is_booked,
      });
    });

    return Array.from(dayMap.values()).slice(0, 4); // Show first 4 days
  }, []);

  function getDayLabel(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    if (checkDate.getTime() === today.getTime()) return 'Today';
    if (checkDate.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return 'Later this week';
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-700"></div>
            <p className="text-sm text-slate-600">Loading availability...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">No Availability Found</p>
          <p className="mt-1 text-xs text-amber-800">{error}</p>
          <p className="mt-2 text-xs text-amber-700">
            Admin: Go to Settings → Google Calendar Sync to connect your calendar and sync availability.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Calendar-style scheduling</h2>
          <p className="text-sm text-slate-600">
            Pick a slot to book your appointment. Times shown in Eastern Time (ET).
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Client view
        </span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {availability.map((day) => (
          <div key={day.fullDate} className="rounded-lg border border-slate-200 p-3">
            <div className="text-sm font-semibold text-slate-800">{day.day}</div>
            <div className="text-xs text-slate-500">{day.date}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {day.slots.map((slot) => {
                const id = `${day.fullDate}-${slot.startIso}`;
                const active = selected === id;
                const disabled = slot.isBooked;
                return (
                  <button
                    key={slot.startIso}
                    onClick={() => !disabled && setSelected(id)}
                    disabled={disabled}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      disabled
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through'
                        : active
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:text-indigo-700'
                    }`}
                  >
                    {slot.time}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {availability.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">No available time slots in the next 7 days.</p>
          <p className="mt-1 text-xs text-slate-500">Please check back later or contact us directly.</p>
        </div>
      )}
      {selected && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-sm text-indigo-900">
            Selected:{' '}
            <span className="font-semibold">
              {availability
                .flatMap((d) => d.slots.map((s) => ({ ...s, date: d.date })))
                .find((s) => `${availability.find((d) => d.slots.includes(s))?.fullDate}-${s.startIso}` === selected)
                ?.date}{' '}
              at{' '}
              {availability
                .flatMap((d) => d.slots)
                .find((s) => selected.includes(s.startIso))?.time}
            </span>
          </p>
          <button
            onClick={() => setSelected(null)}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
