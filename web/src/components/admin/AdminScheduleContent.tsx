'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatTime } from '@/lib/formatting';

type CalendarEvent = {
  id: string;
  service_type: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  status: string | null;
  user_id: string | null;
  client_name?: string;
  estimated_minutes?: number | null;
};

type DayDetail = {
  date: string;
  events: CalendarEvent[];
};

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  complete: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  cancelled: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
};

export default function AdminScheduleContent() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDay, setSelectedDay] = useState<DayDetail | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [weeksAhead, setWeeksAhead] = useState(2);
  const [startDateInput, setStartDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const timeZone = 'America/New_York';

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

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // Build calendar grid
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }
  // Fill remaining cells to complete the grid
  while (calendarDays.length % 7 !== 0) {
    calendarDays.push(null);
  }

  // Week view helpers
  const getWeekDates = () => {
    const curr = new Date(currentDate);
    const first = curr.getDate() - curr.getDay();
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(new Date(curr.getFullYear(), curr.getMonth(), first + i));
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const timeSlots = Array.from({ length: 12 }, (_, i) => i + 7); // 7 AM to 6 PM

  const getEventsForDate = (day: number | null, monthOffset = 0) => {
    if (!day) return [];
    const m = month + monthOffset;
    const y = m < 0 ? year - 1 : m > 11 ? year + 1 : year;
    const adjustedMonth = ((m % 12) + 12) % 12;
    const dateStr = `${y}-${String(adjustedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((event) => event.preferred_date === dateStr);
  };

  const getEventsForDateObj = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return events.filter((event) => event.preferred_date === dateStr);
  };

  const formatDateStr = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const goToPrevious = () => {
    if (view === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      const prev = new Date(currentDate);
      prev.setDate(prev.getDate() - 7);
      setCurrentDate(prev);
    }
  };

  const goToNext = () => {
    if (view === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 7);
      setCurrentDate(next);
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const isTodayDate = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const toggleDay = (dayIndex: number) => {
    setSelectedDays((prev) => {
      const next = prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex];
      return next.sort((a, b) => a - b);
    });
  };

  const dayShortNames = useMemo(() => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], []);

  const handleSaveAvailability = async () => {
    setSavingAvailability(true);
    setAvailabilityError(null);
    setAvailabilityMessage(null);

    try {
      const res = await fetch('/api/admin/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: selectedDays,
          startTime,
          endTime,
          slotMinutes,
          weeks: weeksAhead,
          timeZone,
          startDate: startDateInput,
        }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setAvailabilityError(body?.error || 'Failed to save availability.');
      } else {
        setAvailabilityMessage(body?.message || 'Availability saved.');
      }
    } catch {
      setAvailabilityError('Unable to reach the server. Please try again.');
    } finally {
      setSavingAvailability(false);
    }
  };

  const handleDayClick = (day: number) => {
    const dateStr = formatDateStr(day);
    const dayEvents = getEventsForDate(day);
    setSelectedDay({ date: dateStr, events: dayEvents });
  };

  const getStatusStyle = (status: string | null) => {
    return statusColors[status || 'pending'] || statusColors.pending;
  };

  // Stats
  const todayEvents = events.filter((e) => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return e.preferred_date === dateStr;
  });
  const pendingCount = events.filter((e) => e.status === 'pending').length;
  const confirmedCount = events.filter((e) => e.status === 'confirmed').length;

  return (
    <section className="grid gap-5">
      {/* Availability Generator */}
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Availability</p>
            <h2 className="text-lg font-semibold text-slate-900">Set weekly slots</h2>
            <p className="text-sm text-slate-600">
              Choose the days and hours you work. We&apos;ll generate manual slots for the next few weeks.
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
            Time zone: {timeZone}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Days</p>
            <div className="flex flex-wrap gap-2">
              {dayShortNames.map((day, idx) => {
                const active = selectedDays.includes(idx);
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(idx)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                      active
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hours</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm text-slate-600">
                Start
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="ml-2 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                />
              </label>
              <label className="text-sm text-slate-600">
                End
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="ml-2 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start date</p>
            <input
              type="date"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Slot length</p>
            <select
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {[30, 45, 60, 90, 120].map((mins) => (
                <option key={mins} value={mins}>
                  {mins} minutes
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Weeks ahead</p>
            <select
              value={weeksAhead}
              onChange={(e) => setWeeksAhead(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {[1, 2, 3, 4, 6, 8, 12].map((wk) => (
                <option key={wk} value={wk}>
                  {wk} week{wk === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Generates manual slots and replaces unbooked manual slots in the range. Booked slots and Google Calendar
              imports stay untouched.
            </div>
          </div>
        </div>

        {(availabilityMessage || availabilityError) && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              availabilityError
                ? 'border border-rose-200 bg-rose-50 text-rose-800'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {availabilityError || availabilityMessage}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleSaveAvailability}
            disabled={savingAvailability || !selectedDays.length}
            className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {savingAvailability ? 'Saving...' : 'Save availability'}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Today</p>
          <p className="text-2xl font-bold text-slate-900">{todayEvents.length}</p>
          <p className="text-xs text-slate-500">appointments</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          <p className="text-xs text-slate-500">need confirmation</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Confirmed</p>
          <p className="text-2xl font-bold text-emerald-600">{confirmedCount}</p>
          <p className="text-xs text-slate-500">upcoming</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">This Month</p>
          <p className="text-2xl font-bold text-slate-900">{events.filter((e) => e.preferred_date?.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length}</p>
          <p className="text-xs text-slate-500">total bookings</p>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevious}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <span className="text-lg">‹</span>
          </button>
          <button
            onClick={goToToday}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Today
          </button>
          <button
            onClick={goToNext}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <span className="text-lg">›</span>
          </button>
        </div>

        <h3 className="text-lg font-semibold text-slate-900">
          {view === 'week'
            ? `${monthNames[weekDates[0].getMonth()]} ${weekDates[0].getDate()} - ${weekDates[6].getDate()}, ${weekDates[0].getFullYear()}`
            : `${monthNames[month]} ${year}`
          }
        </h3>

        <div className="flex items-center rounded-lg border border-slate-200 p-1">
          {(['month', 'week'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                view === v
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-5">
        {/* Calendar */}
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-12">
              <div className="text-center">
                <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
                <p className="text-sm text-slate-600">Loading schedule...</p>
              </div>
            </div>
          ) : view === 'month' ? (
            /* Month View */
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                {dayNames.map((dayName) => (
                  <div key={dayName} className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => {
                  const dayEvents = getEventsForDate(day);
                  const today = isToday(day);
                  const hasEvents = dayEvents.length > 0;

                  return (
                    <button
                      key={index}
                      onClick={() => day && handleDayClick(day)}
                      disabled={!day}
                      className={`relative min-h-[100px] border-b border-r border-slate-100 p-2 text-left transition ${
                        day ? 'hover:bg-indigo-50/50' : 'bg-slate-50/50'
                      } ${today ? 'bg-indigo-50' : ''} ${
                        selectedDay?.date === (day ? formatDateStr(day) : '') ? 'ring-2 ring-inset ring-indigo-500' : ''
                      }`}
                    >
                      {day && (
                        <>
                          <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
                              today
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-700'
                            }`}
                          >
                            {day}
                          </span>

                          {hasEvents && (
                            <div className="mt-1 space-y-1">
                              {dayEvents.slice(0, 2).map((event) => {
                                const style = getStatusStyle(event.status);
                                return (
                                  <div
                                    key={event.id}
                                    className={`flex items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-xs ${style.bg} ${style.text}`}
                                  >
                                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${style.dot}`}></span>
                                    <span className="truncate">{formatTime(event.preferred_time)} {event.service_type}</span>
                                  </div>
                                );
                              })}
                              {dayEvents.length > 2 && (
                                <p className="pl-1.5 text-xs font-medium text-indigo-600">+{dayEvents.length - 2} more</p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Week View */
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {/* Day headers */}
              <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50">
                <div className="border-r border-slate-200"></div>
                {weekDates.map((date, i) => {
                  const isCurrentDay = isTodayDate(date);
                  return (
                    <div
                      key={i}
                      className={`border-r border-slate-200 px-2 py-3 text-center last:border-r-0 ${
                        isCurrentDay ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <p className="text-xs font-medium uppercase text-slate-500">{dayNames[i]}</p>
                      <p className={`mt-1 text-lg font-semibold ${isCurrentDay ? 'text-indigo-600' : 'text-slate-900'}`}>
                        {date.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Time slots */}
              <div className="max-h-[500px] overflow-y-auto">
                {timeSlots.map((hour) => (
                  <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-100 last:border-b-0">
                    <div className="border-r border-slate-200 px-2 py-3 text-right text-xs font-medium text-slate-500">
                      {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                    </div>
                    {weekDates.map((date, i) => {
                      const dayEvents = getEventsForDateObj(date).filter((e) => {
                        if (!e.preferred_time) return false;
                        const eventHour = parseInt(e.preferred_time.split(':')[0] || e.preferred_time);
                        return eventHour === hour || (e.preferred_time.includes('PM') && hour === eventHour + 12);
                      });

                      return (
                        <div
                          key={i}
                          className="min-h-[60px] border-r border-slate-100 p-1 last:border-r-0 hover:bg-slate-50"
                        >
                          {dayEvents.map((event) => {
                            const style = getStatusStyle(event.status);
                            return (
                              <Link
                                key={event.id}
                                href={`/admin/requests/${event.id}`}
                                className={`mb-1 block truncate rounded px-2 py-1 text-xs ${style.bg} ${style.text} hover:opacity-80`}
                              >
                                {event.service_type}
                              </Link>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Day Detail Panel */}
        {selectedDay && (
          <div className="w-80 flex-shrink-0 rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {dayNamesFull[new Date(selectedDay.date).getDay()]}
                  </p>
                  <p className="text-xl font-semibold text-slate-900">
                    {new Date(selectedDay.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {selectedDay.events.length} appointment{selectedDay.events.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="max-h-[400px] overflow-y-auto p-4">
              {selectedDay.events.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
                  <p className="text-sm text-slate-500">No appointments</p>
                  <p className="mt-1 text-xs text-slate-400">This day is open for bookings</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDay.events
                    .sort((a, b) => (a.preferred_time || '').localeCompare(b.preferred_time || ''))
                    .map((event) => {
                      const style = getStatusStyle(event.status);
                      return (
                        <Link
                          key={event.id}
                          href={`/admin/requests/${event.id}`}
                          className="block rounded-lg border border-slate-200 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/50"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900">{event.service_type || 'Service'}</p>
                              <p className="mt-0.5 text-sm text-slate-600">{formatTime(event.preferred_time)}</p>
                              {event.estimated_minutes && (
                                <p className="text-xs text-slate-500">{event.estimated_minutes} min</p>
                              )}
                            </div>
                            <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                              {event.status}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Legend:</span>
        {Object.entries(statusColors).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${colors.dot}`}></span>
            <span className="text-sm capitalize text-slate-600">{status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
