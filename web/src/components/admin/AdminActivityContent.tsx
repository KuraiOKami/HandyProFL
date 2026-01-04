'use client';

export default function AdminActivityContent() {
  return (
    <section className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h2 className="text-xl font-semibold text-slate-900">Activity</h2>
        <p className="text-sm text-slate-600">Audit trail of status changes and admin actions.</p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        TODO: Add an activity_log table and surface recent changes here.
      </div>
    </section>
  );
}
