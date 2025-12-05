export default function AdminNotificationsPage() {
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Notifications</h1>
        <p className="text-sm text-slate-600">Email/SMS templates and bulk sends.</p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        TODO: Hook into notification_preferences, templates, and a sender (SMTP/Twilio).
      </div>
    </div>
  );
}
