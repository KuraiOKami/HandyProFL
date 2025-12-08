'use client';

export default function AdminScheduleContent() {
  return (
    <section className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h2 className="text-xl font-semibold text-slate-900">Schedule</h2>
        <p className="text-sm text-slate-600">Calendar built from confirmed requests and available slots.</p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        TODO: Render a calendar view; open/close slots and drag-reschedule confirmed bookings.
      </div>
    </section>
  );
}
