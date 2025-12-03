import ServiceRequestForm from "@/components/ServiceRequestForm";
import Link from "next/link";

export default function RequestsPage() {
  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Book a visit</p>
          <h1 className="text-3xl font-semibold text-slate-900">Service request</h1>
          <p className="text-sm text-slate-600">
            Choose your service, add notes, and include your ideal time window. We will confirm quickly.
          </p>
        </div>
        <Link href="/schedule" className="rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800">
          Check availability
        </Link>
      </div>
      <ServiceRequestForm />
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-600">
        Requests are stored in Supabase table <code className="rounded bg-slate-100 px-1 py-0.5">service_requests</code>.
        Enable row-level security to limit records to the signed-in user, and add a status column (pending/confirmed/done).
      </div>
    </div>
  );
}
