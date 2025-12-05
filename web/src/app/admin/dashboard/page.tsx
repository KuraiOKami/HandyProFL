export default function AdminDashboardPage() {
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">Snapshot of requests, clients, and schedule.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Pending requests", value: "—" },
          { title: "Today’s appointments", value: "—" },
          { title: "New clients this week", value: "—" },
        ].map((card) => (
          <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">{card.title}</p>
            <p className="text-2xl font-semibold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
