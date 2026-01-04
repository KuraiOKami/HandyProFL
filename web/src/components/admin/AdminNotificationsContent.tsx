'use client';

export default function AdminNotificationsContent() {
  return (
    <section className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h2 className="text-xl font-semibold text-slate-900">Notifications</h2>
        <p className="text-sm text-slate-600">Email/SMS templates and bulk sends.</p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        SMS sending is available via <code>/api/notifications/send</code> (admin-only) and respects
        user <code>notification_preferences</code>. Push notifications are queued for later implementation.
      </div>
    </section>
  );
}
