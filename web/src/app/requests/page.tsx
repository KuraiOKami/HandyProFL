'use client';

import { useRef } from "react";
import Link from "next/link";
import RequestWizard, { RequestWizardHandle, ServiceId, services } from "@/components/RequestWizard";

export default function RequestsPage() {
  const wizardRef = useRef<RequestWizardHandle | null>(null);
  const launchWizard = (svc?: ServiceId) => {
    wizardRef.current?.open(svc);
  };

  const shortcuts = (["tv_mount", "assembly", "electrical", "punch"] as ServiceId[]).map((id) => ({
    id,
    name: services[id].name,
    description: services[id].description,
    icon: services[id].icon,
  }));

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-8 text-white shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-200">Book a visit</p>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl space-y-3">
            <h1 className="text-4xl font-semibold leading-tight">Need a handyman? Start a request in seconds.</h1>
            <p className="text-lg text-indigo-100">
              Pick the service, upload a couple notes or photos, choose your time, and pay securely by card.
              We confirm quickly and keep you posted.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-indigo-100">
              <span className="rounded-full bg-white/15 px-3 py-1">TV mounting & assembly pros</span>
              <span className="rounded-full bg-white/15 px-3 py-1">Upfront timing estimates</span>
              <span className="rounded-full bg-white/15 px-3 py-1">Secure card checkout</span>
            </div>
          </div>
          <button
            onClick={() => launchWizard()}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-indigo-800 shadow-lg shadow-indigo-700/30 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            Start new request
          </button>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Jump right in</p>
            <h2 className="text-2xl font-semibold text-slate-900">Popular services</h2>
            <p className="text-sm text-slate-600">Tap a service to prefill the booking flow.</p>
          </div>
          <Link href="/services" className="text-sm font-semibold text-indigo-700 hover:text-indigo-800">
            See full list →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shortcuts.map((svc) => (
            <button
              key={svc.id}
              onClick={() => launchWizard(svc.id)}
              className="flex h-full flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
            >
              <span className="text-2xl">{svc.icon}</span>
              <div className="grid gap-1">
                <span className="text-base font-semibold text-slate-900">{svc.name}</span>
                <span className="text-sm text-slate-600">{svc.description}</span>
              </div>
              <span className="text-xs font-semibold text-indigo-700">Book this</span>
            </button>
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-700">
          Already started? Manage your address, wallet, and past requests in{" "}
          <Link href="/settings" className="font-semibold text-indigo-700 hover:text-indigo-800">
            Settings
          </Link>
          .
        </p>
      </div>

      <RequestWizard ref={wizardRef} />
    </div>
  );
}
