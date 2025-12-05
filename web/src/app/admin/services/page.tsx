export default function AdminServicesPage() {
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Services</h1>
        <p className="text-sm text-slate-600">Manage catalog, pricing, and estimated durations.</p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        TODO: Connect to a service_catalog table and allow editing durations used by the request wizard.
      </div>
    </div>
  );
}
