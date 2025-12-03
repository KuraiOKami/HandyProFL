'use client';

import { FormEvent, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';

const defaultServices = [
  'Furniture assembly',
  'TV mounting',
  'Ceiling fan install',
  'Light fixture swap',
  'Door/lock repair',
  'Drywall patch',
  'Pressure washing',
  'Misc small jobs',
];

export default function ServiceRequestForm() {
  const { session } = useSupabaseSession();
  const supabase = getSupabaseClient();
  const [service, setService] = useState(defaultServices[0]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const userId = session?.user?.id ?? null;
  const canSubmit = useMemo(() => Boolean(userId && supabase), [userId, supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || !supabase) {
      setError('Sign in to request a service.');
      return;
    }
    setSubmitting(true);
    setStatus(null);
    setError(null);

    const { error: insertError } = await supabase.from('service_requests').insert({
      user_id: userId,
      service_type: service,
      preferred_date: date || null,
      preferred_time: time || null,
      details: details || null,
      status: 'pending',
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setStatus('Request submitted. We will confirm the appointment shortly.');
      setDetails('');
      setDate('');
      setTime('');
    }
    setSubmitting(false);
  };

  return (
    <div className="grid gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Request a handyman visit</h2>
        <p className="text-sm text-slate-600">
          Pick a service, add when works best, and we will confirm via email/SMS.
        </p>
        {!session && <p className="mt-2 text-xs font-medium text-amber-700">Sign in to submit a request.</p>}
      </div>
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 md:gap-6">
        <label className="grid gap-1 text-sm text-slate-800">
          Service
          <select
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {defaultServices.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm text-slate-800">
          Preferred date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-800">
          Preferred time window
          <input
            type="text"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="e.g., 9–11 AM"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-800 md:col-span-2">
          Details (access, photos, notes)
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? 'Submitting...' : 'Submit request'}
          </button>
          <p className="text-xs text-slate-500">
            Your request is saved to Supabase table <code className="rounded bg-slate-100 px-1 py-0.5">service_requests</code>.
          </p>
        </div>
      </form>
      {status && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{status}</p>}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
    </div>
  );
}
