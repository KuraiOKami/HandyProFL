'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type CalendarEvent = {
  id: string;
  service_type: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  status: string | null;
  user_id: string | null;
};

export default function AdminScheduleContent() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'month' | 'week'>('month');

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetch('/api/admin/schedule');
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events ?? []);
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  // Get days in current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

  // Build calendar grid
  const calendarDays: (number | null)[] = [];
  // Add empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  // Add days of month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Get events for a specific date
  const getEventsForDate = (day: number | null) => {
    if (!day) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((event) => event.preferred_date === dateStr);
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  return (
    <section className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h2 className="text-xl font-semibold text-slate-900">Schedule</h2>
        <p className="text-sm text-slate-600">View and manage confirmed requests and available slots.</p>
      </div>

      {/* Calendar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={goToPreviousMonth}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700"
          >
            ‹ Prev
          </button>
          <button
            onClick={goToToday}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700"
          >
            Today
          </button>
          <button
            onClick={goToNextMonth}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700"
          >
            Next ›
          </button>
        </div>
        <h3 className="text-lg font-semibold text-slate-900">
          {monthNames[month]} {year}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('month')}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              view === 'month' ? 'bg-indigo-700 text-white' : 'border border-slate-300 text-slate-800 hover:border-indigo-600'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setView('week')}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              view === 'week' ? 'bg-indigo-700 text-white' : 'border border-slate-300 text-slate-800 hover:border-indigo-600'
            }`}
          >
            Week
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <p className="text-sm text-slate-600">Loading schedule...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {dayNames.map((dayName) => (
              <div key={dayName} className="p-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-700">
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
            {calendarDays.map((day, index) => {
              const dayEvents = getEventsForDate(day);
              const today = isToday(day);

              return (
                <div
                  key={index}
                  className={`min-h-[120px] p-2 ${day ? 'bg-white hover:bg-slate-50' : 'bg-slate-50'} ${
                    today ? 'bg-indigo-50' : ''
                  }`}
                >
                  {day && (
                    <>
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold ${
                            today ? 'bg-indigo-700 text-white' : 'text-slate-700'
                          }`}
                        >
                          {day}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <Link
                            key={event.id}
                            href={`/admin/requests/${event.id}`}
                            className={`block truncate rounded px-1.5 py-0.5 text-xs font-medium transition ${
                              event.status === 'confirmed'
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : event.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                            title={`${event.service_type} - ${event.preferred_time} (${event.status})`}
                          >
                            {event.preferred_time} {event.service_type}
                          </Link>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs font-semibold text-indigo-700">+{dayEvents.length - 3} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-green-100 ring-1 ring-green-300"></div>
          <span className="text-sm text-slate-700">Confirmed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-amber-100 ring-1 ring-amber-300"></div>
          <span className="text-sm text-slate-700">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-slate-100 ring-1 ring-slate-300"></div>
          <span className="text-sm text-slate-700">Other</span>
        </div>
      </div>
    </section>
  );
}
