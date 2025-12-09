import RequestWizard from "@/components/RequestWizard";

export default function RequestsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Book a visit</p>
        <h1 className="text-3xl font-semibold text-slate-900">Service request</h1>
        <p className="text-sm text-slate-600">
          Choose your service, add notes, and include your ideal time window. We will confirm quickly.
        </p>
      </div>
      <RequestWizard />
    </div>
  );
}
