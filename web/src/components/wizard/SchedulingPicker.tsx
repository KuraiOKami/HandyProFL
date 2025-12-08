import { useEffect, useMemo } from 'react';
import type { Slot } from '@/hooks/useRequestWizard';

type SchedulingPickerProps = {
  date: string;
  onDateChange: (date: string) => void;
  slot: { time: string; startIso: string } | null;
  onSlotChange: (slot: { time: string; startIso: string } | null) => void;
  availableSlots: Record<string, Slot[]>;
  onLoadSlots: (date: string) => void;
  slotDurationMinutes: number | null;
  requiredSlots: number;
};

const DISPLAY_TIME_ZONE = 'America/New_York';

function nextDays(days = 14) {
  const out: { label: string; value: string }[] = [];
  const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const value = d.toISOString().slice(0, 10);
    out.push({ label: formatter.format(d), value });
  }
  return out;
}

export default function SchedulingPicker({
  date,
  onDateChange,
  slot,
  onSlotChange,
  availableSlots,
  onLoadSlots,
  slotDurationMinutes,
  requiredSlots,
}: SchedulingPickerProps) {
  const dates = useMemo(() => nextDays(14), []);
  const selectedSlots = useMemo(() => availableSlots[date] ?? [], [availableSlots, date]);

  useEffect(() => {
    if (date) {
      onLoadSlots(date);
    }
  }, [date, onLoadSlots]);

  return (
    <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
      <div className="grid gap-3 rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900">Pick a date</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {dates.map((d) => (
            <button
              key={d.value}
              onClick={() => onDateChange(d.value)}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${
                date === d.value
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                  : 'border-slate-200 hover:border-indigo-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900">Pick a time</p>
        {date ? (
          selectedSlots.length ? (
            <div className="grid grid-cols-2 gap-2">
              {selectedSlots.map((s, idx) => {
                const fits =
                  slotDurationMinutes != null &&
                  selectedSlots.slice(idx, idx + requiredSlots).length === requiredSlots &&
                  selectedSlots.slice(idx, idx + requiredSlots).every((slotObj) => slotObj.available);
                const disabled = !fits;
                return (
                  <button
                    key={s.startIso}
                    onClick={() => !disabled && onSlotChange({ time: s.time, startIso: s.startIso })}
                    disabled={disabled}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      slot?.startIso === s.startIso
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                        : 'border-slate-200 hover:border-indigo-200'
                    } ${
                      disabled ? 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-70 line-through' : ''
                    }`}
                  >
                    {s.time}
                    {fits ? '' : ' (unavailable)'}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No slots available for this date.</p>
          )
        ) : (
          <p className="text-sm text-slate-600">Select a date to see available times.</p>
        )}
      </div>
    </div>
  );
}
