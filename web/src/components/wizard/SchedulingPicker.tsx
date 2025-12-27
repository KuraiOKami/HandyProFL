import { useMemo } from 'react';

type SchedulingPickerProps = {
  date: string;
  onDateChange: (date: string) => void;
  slot: { time: string; startIso: string } | null;
  onSlotChange: (slot: { time: string; startIso: string } | null) => void;
  // Legacy props (kept for compatibility but not used in gig-based flow)
  availableSlots?: Record<string, unknown[]>;
  onLoadSlots?: (date: string) => void;
  slotDurationMinutes?: number | null;
  requiredSlots?: number;
};

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

// Generate time slots from 9 AM to 7 PM
function generateTimeSlots() {
  const slots: { time: string; value: string }[] = [];
  for (let hour = 9; hour <= 19; hour++) {
    const hour12 = hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const timeLabel = `${hour12}:00 ${ampm}`;
    const timeValue = `${hour.toString().padStart(2, '0')}:00`;
    slots.push({ time: timeLabel, value: timeValue });

    // Add :30 slot except for 7 PM
    if (hour < 19) {
      const halfLabel = `${hour12}:30 ${ampm}`;
      const halfValue = `${hour.toString().padStart(2, '0')}:30`;
      slots.push({ time: halfLabel, value: halfValue });
    }
  }
  return slots;
}

export default function SchedulingPicker({
  date,
  onDateChange,
  slot,
  onSlotChange,
}: SchedulingPickerProps) {
  const dates = useMemo(() => nextDays(14), []);
  const timeSlots = useMemo(() => generateTimeSlots(), []);

  const handleTimeSelect = (timeSlot: { time: string; value: string }) => {
    if (!date) return;
    // Create an ISO string for the selected date/time
    const startIso = `${date}T${timeSlot.value}:00`;
    onSlotChange({ time: timeSlot.time, startIso });
  };

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900 mb-3">Preferred Date</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
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

      <div className="rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900 mb-3">Preferred Time</p>
        {date ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {timeSlots.map((t) => (
              <button
                key={t.value}
                onClick={() => handleTimeSelect(t)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  slot?.time === t.time
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                    : 'border-slate-200 hover:border-indigo-200'
                }`}
              >
                {t.time}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">Select a date first.</p>
        )}
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-xs text-blue-800">
          This is your <strong>preferred</strong> time. A handyman will accept your request if they&apos;re available.
          Service hours are 9 AM - 7 PM.
        </p>
      </div>
    </div>
  );
}
