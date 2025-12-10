import Link from "next/link";
import { coreServices } from "@/lib/services";

export default function Home() {
  return (
    <div className="grid gap-10">
      <section className="grid gap-8 rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 px-8 py-10 text-white shadow-lg">
        <div className="grid gap-4 md:max-w-4xl">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-200">Tampa Bay handyman</p>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            On-time help for TV mounting, assembly, and small electrical — book online in minutes.
          </h1>
          <p className="text-lg text-indigo-100">
            Skip the back-and-forth. Choose your service, pick a time, and pay securely by card. We show up ready with
            the right tools, hardware, and clean finishes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/requests"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-indigo-800 shadow-lg shadow-indigo-700/30 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Book a visit
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              View services
            </Link>
          </div>
        </div>
        <div className="grid gap-4 rounded-2xl bg-white/10 p-5 backdrop-blur">
          <div className="flex flex-wrap items-center gap-4 text-sm text-indigo-100">
            <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">TV mounting & wire hiding</span>
            <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">Furniture assembly</span>
            <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">Fixture/fan swaps</span>
            <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">Punch list touch-ups</span>
          </div>
          <div className="grid gap-2 text-sm text-indigo-100 md:grid-cols-3">
            <p>Real schedule selection with arrival windows.</p>
            <p>Secure Stripe checkout — cards only.</p>
            <p>Text/email updates from confirmation to completion.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Handyman services</p>
            <h2 className="text-2xl font-semibold text-slate-900">Popular tasks</h2>
          </div>
          <Link href="/services" className="text-sm font-semibold text-indigo-700 hover:text-indigo-800">
            See all services →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {coreServices.map((service) => (
            <div key={service.name} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold text-slate-900">{service.name}</h3>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {service.duration}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{service.description}</p>
              {service.price && <p className="mt-3 text-sm font-semibold text-slate-900">{service.price}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">How it works</p>
            <h3 className="text-xl font-semibold text-slate-900">Book in three steps</h3>
          </div>
          <Link
            href="/requests"
            className="inline-flex items-center rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800"
          >
            Start booking
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "1) Tell us the task",
              copy: "Pick the service, add notes/photos, and confirm any special hardware we should bring.",
            },
            {
              title: "2) Choose your time",
              copy: "Select the arrival window that works. We block enough time based on your details.",
            },
            {
              title: "3) Pay & get updates",
              copy: "Check out with card. You'll get confirmation plus day-of reminders by email/SMS.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-slate-200 p-4">
              <h4 className="text-base font-semibold text-slate-900">{item.title}</h4>
              <p className="mt-2 text-sm text-slate-600">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
