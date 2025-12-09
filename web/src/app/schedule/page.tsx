import AvailabilityGrid from "@/components/AvailabilityGrid";

export default function SchedulePage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Scheduling</p>
        <h1 className="text-3xl font-semibold text-slate-900">Pick a time</h1>
        <p className="text-sm text-slate-600">
          Select an available time slot below. Availability is synced with Google Calendar.
        </p>
      </div>
      <AvailabilityGrid />
    </div>
  );
}
