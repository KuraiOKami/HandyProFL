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
            Select an available time slot below. Availability is synced with Google Calendar.
          </p>
        </div>
        <Link href="/requests" className="rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800">
          Add to service request
        </Link>
      </div>
      <AvailabilityGrid />
    </div>
  );
}
