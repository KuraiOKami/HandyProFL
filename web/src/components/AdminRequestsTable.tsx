'use client';

import { useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

type Request = {
  id: string;
  service_type: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  details: string | null;
  status: string | null;
  estimated_minutes?: number | null;
  user_id: string | null;
  created_at?: string | null;
};

const statuses = ['pending', 'confirmed', 'complete', 'cancelled'];

export default function AdminRequestsTable({ initial }: { initial: Request[] }) {
  const [requests, setRequests] = useState<Request[]>(initial);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateRequest = async (id: string, updates: Partial<Request>) => {
    setSavingId(id);
    setError(null);
    const res = await fetch('/api/admin/requests/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Failed to update request.');
      setSavingId(null);
      return;
    }
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    setSavingId(null);
  };

  return (
    <div className="grid gap-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
          <h2 className="text-xl font-semibold text-slate-900">All requests</h2>
          <p className="text-sm text-slate-600">Update status or reschedule directly.</p>
        </div>
      </div>
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      <div className="grid gap-2">
        {requests.map((req) => (
          <div key={req.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {req.service_type || 'Service'}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                  {req.status || 'pending'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {req.preferred_date || 'Date'} @ {req.preferred_time || 'Time'} | Est: {req.estimated_minutes ?? '—'} min
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">User: {req.user_id || 'Unknown'}</p>
            <p className="mt-2 text-sm text-slate-800">{req.details || 'No details.'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={req.status ?? 'pending'}
                onChange={(e) => updateRequest(req.id, { status: e.target.value })}
                disabled={savingId === req.id}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={req.preferred_date ?? ''}
                onChange={(e) => updateRequest(req.id, { preferred_date: e.target.value })}
                disabled={savingId === req.id}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <input
                type="text"
                value={req.preferred_time ?? ''}
                onChange={(e) => updateRequest(req.id, { preferred_time: e.target.value })}
                disabled={savingId === req.id}
                placeholder="e.g., 9:00 AM"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <button
                onClick={() => updateRequest(req.id, { status: 'cancelled' })}
                disabled={savingId === req.id}
                className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        ))}
        {!requests.length && <p className="text-sm text-slate-600">No requests found.</p>}
      </div>
    </div>
  );
}
