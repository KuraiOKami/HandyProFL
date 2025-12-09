import { coreServices } from "@/lib/services";

export default function ServicesPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Handyman menu</p>
        <h1 className="text-3xl font-semibold text-slate-900">Services we handle</h1>
        <p className="text-sm text-slate-600">Book online and get confirmations via email/SMS.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {coreServices.map((service) => (
          <div key={service.name} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{service.name}</h2>
                <p className="mt-2 text-sm text-slate-600">{service.description}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{service.price}</p>
                <p className="text-xs text-slate-500">{service.duration}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50 p-5 text-sm text-indigo-900">
        Need something not listed? Add it in the request notes and we will confirm if it fits our scope (non-licensed handyman tasks).
      </div>
    </div>
  );
}
