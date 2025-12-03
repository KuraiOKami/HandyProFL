import AvailabilityGrid from "@/components/AvailabilityGrid";
import Link from "next/link";

export default function SchedulePage() {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Scheduling</p>
          <h1 className="text-3xl font-semibold text-slate-900">Pick a time</h1>
          <p className="text-sm text-slate-600">
            Mirror a Calendly-style flow and later connect to Google Calendar + email/SMS confirmations.
          </p>
        </div>
        <Link href="/requests" className="rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800">
          Add to service request
        </Link>
      </div>
      <AvailabilityGrid />
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-600">
        To sync Google Calendar, create a Supabase Edge Function or Netlify serverless function that checks availability
        and books events. Expose available slots via a view/table (e.g., <code className="rounded bg-slate-100 px-1 py-0.5">available_slots</code>).
      </div>
    </div>
  );
}
