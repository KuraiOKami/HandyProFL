'use client';

export default function AdminSettingsContent() {
  return (
    <section className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-600">Branding, roles, integrations, and guardrails.</p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        TODO: Manage admin roles, company info, and API keys/webhooks.
      </div>
    </section>
  );
}
