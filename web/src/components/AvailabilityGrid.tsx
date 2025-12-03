'use client';

import { useState } from 'react';

const sampleAvailability = [
  { day: 'Today', date: 'Mon', slots: ['10:00 AM', '1:00 PM', '3:30 PM'] },
  { day: 'Tomorrow', date: 'Tue', slots: ['9:00 AM', '12:30 PM', '4:00 PM'] },
  { day: 'Later this week', date: 'Wed', slots: ['8:30 AM', '11:00 AM', '2:00 PM'] },
  { day: 'Later this week', date: 'Thu', slots: ['9:30 AM', '1:30 PM', '5:00 PM'] },
];

export default function AvailabilityGrid() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Calendar-style scheduling</h2>
          <p className="text-sm text-slate-600">
            Pick a slot now or sync with Google Calendar later. This mirrors a Calendly-style flow.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Client view
        </span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {sampleAvailability.map((day) => (
          <div key={`${day.day}-${day.date}`} className="rounded-lg border border-slate-200 p-3">
            <div className="text-sm font-semibold text-slate-800">{day.day}</div>
            <div className="text-xs text-slate-500">{day.date}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {day.slots.map((slot) => {
                const id = `${day.day}-${slot}`;
                const active = selected === id;
                return (
                  <button
                    key={slot}
                    onClick={() => setSelected(id)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      active
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:text-indigo-700'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {selected && (
        <p className="mt-4 text-sm text-slate-700">
          Selected slot: <span className="font-semibold">{selected.replace('-', ', ')}</span>. Add it to a service request
          or wire up Google Calendar via Supabase Edge Functions.
        </p>
      )}
    </div>
  );
}
