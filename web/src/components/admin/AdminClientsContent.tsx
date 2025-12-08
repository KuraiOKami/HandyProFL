'use client';

import { useEffect, useState } from 'react';

type ClientProfile = {
  id: string;
  first_name: string | null;
  middle_initial: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  role: string | null;
};

export default function AdminClientsContent() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [requestMap, setRequestMap] = useState<Map<string, number>>(new Map());
  const [addressMap, setAddressMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const res = await fetch('/api/admin/clients');

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || 'Failed to load clients');
          setLoading(false);
          return;
        }

        const { clients, requestCounts, addressCounts } = await res.json();
        setClients(clients ?? []);

        // Convert counts to maps
        const reqMap = new Map<string, number>();
        Object.entries(requestCounts || {}).forEach(([userId, count]) => {
          reqMap.set(userId, count as number);
        });
        setRequestMap(reqMap);

        const addrMap = new Map<string, number>();
        Object.entries(addressCounts || {}).forEach(([userId, count]) => {
          addrMap.set(userId, count as number);
        });
        setAddressMap(addrMap);

        setLoading(false);
      } catch {
        setError('Failed to load clients');
        setLoading(false);
      }
    };

    loadClients();
  }, []);

  return (
    <section className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h2 className="text-xl font-semibold text-slate-900">Clients</h2>
        <p className="text-sm text-slate-600">CRM-style list of clients and their history.</p>
      </div>
      {loading && <p className="text-sm text-slate-600">Loading clients...</p>}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {!loading && !error && (
        <div className="grid gap-3">
          {clients.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {[c.first_name, c.middle_initial, c.last_name].filter(Boolean).join(' ') || 'Unknown'}
                  </p>
                  <p className="text-sm text-slate-600">
                    {c.email || 'No email'} • {c.phone || 'No phone'}
                  </p>
                </div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {c.role || 'client'}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">
                {[c.street, c.city, c.state, c.postal_code].filter(Boolean).join(', ') || 'No address on file'}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
                  Requests: {requestMap.get(c.id) ?? 0}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
                  Addresses: {addressMap.get(c.id) ?? 0}
                </span>
              </div>
            </div>
          ))}
          {!clients.length && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
              No clients found.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
