import Link from "next/link";
import { coreServices } from "@/lib/services";

export default function Home() {
  return (
    <div className="grid gap-10">
      <section className="grid gap-8 rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 px-8 py-10 text-white shadow-lg">
        <div className="grid gap-4 md:max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-200">Angi Services partner</p>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            HandyProFL — book handyman help without the phone tag.
          </h1>
          <p className="text-lg text-indigo-100">
            Clients can create a profile, sign in with email/password or phone code, and request a visit. We will sync
            availability to a Google Calendar style flow.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-indigo-800 shadow-lg shadow-indigo-700/30 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Sign in or create account
            </Link>
            <Link
              href="/schedule"
              className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              View scheduling
            </Link>
          </div>
        </div>
        <div className="grid gap-4 rounded-2xl bg-white/10 p-5 backdrop-blur">
          <div className="flex flex-wrap items-center gap-4 text-sm text-indigo-100">
            <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">Assembly</span>
            <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">Mounting</span>
            <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">Electrical swaps</span>
            <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">Punch lists</span>
          </div>
          <p className="text-sm text-indigo-100">
            Book online, get confirmations via email/SMS, and sync to your calendar. Perfect for repeat Angi clients who
            want quick scheduling.
          </p>
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
            href="/auth"
            className="inline-flex items-center rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800"
          >
            Start booking
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: '1) Create your profile',
              copy: 'Sign up with email/password or phone code to save your address and contact info.',
            },
            {
              title: '2) Pick service + slot',
              copy: 'Choose the task, share notes/photos, and select a time that fits. We mirror a Calendly-like picker.',
            },
            {
              title: '3) Confirm & reminders',
              copy: 'Requests save to Supabase, and we will sync to Google Calendar plus send email/SMS confirmations.',
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
