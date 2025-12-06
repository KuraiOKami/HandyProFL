'use client';

import { useState } from 'react';

type Service = {
  id: string;
  name: string;
  base_minutes: number | null;
  price_cents?: number | null;
};

export default function AdminServicesTable({ initial }: { initial: Service[] }) {
  const [services, setServices] = useState<Service[]>(initial);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newService, setNewService] = useState<Service>({ id: '', name: '', base_minutes: 60, price_cents: null });

  const updateService = async (id: string, updates: Partial<Service>) => {
    setSavingId(id);
    setError(null);
    const res = await fetch('/api/admin/services/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Failed to update service.');
      setSavingId(null);
      return;
    }
    setServices((prev) => prev.map((svc) => (svc.id === id ? { ...svc, ...updates } : svc)));
    setSavingId(null);
  };

  const addService = async () => {
    if (!newService.id || !newService.name) {
      setError('ID and Name are required.');
      return;
    }
    setSavingId('new');
    setError(null);
    const res = await fetch('/api/admin/services/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newService),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Failed to add service.');
      setSavingId(null);
      return;
    }
    setServices((prev) => [...prev, newService]);
    setNewService({ id: '', name: '', base_minutes: 60, price_cents: null });
    setSavingId(null);
  };

  const removeService = async (id: string) => {
    setSavingId(id);
    setError(null);
    const res = await fetch('/api/admin/services/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Failed to delete service.');
      setSavingId(null);
      return;
    }
    setServices((prev) => prev.filter((svc) => svc.id !== id));
    setSavingId(null);
  };

  return (
    <div className="grid gap-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Catalog</p>
          <h2 className="text-xl font-semibold text-slate-900">Service durations</h2>
        </div>
      </div>
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-900">Add service</p>
        <div className="grid gap-2 md:grid-cols-4 md:items-center">
          <input
            type="text"
            placeholder="id"
            value={newService.id}
            onChange={(e) => setNewService((p) => ({ ...p, id: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
          />
          <input
            type="text"
            placeholder="Name"
            value={newService.name}
            onChange={(e) => setNewService((p) => ({ ...p, name: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
          />
          <input
            type="number"
            min={15}
            value={newService.base_minutes ?? 60}
            onChange={(e) => setNewService((p) => ({ ...p, base_minutes: Number(e.target.value) }))}
            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              placeholder="Price (cents)"
              value={newService.price_cents ?? ''}
              onChange={(e) =>
                setNewService((p) => ({
                  ...p,
                  price_cents: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
            />
            <button
              onClick={addService}
              disabled={savingId === 'new'}
              className="whitespace-nowrap rounded-lg bg-indigo-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {savingId === 'new' ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Minutes</th>
              <th className="px-3 py-2">Price (cents)</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {services.map((svc) => (
              <tr key={svc.id} className="align-middle">
                <td className="px-3 py-2 text-xs font-mono text-slate-600">{svc.id}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    defaultValue={svc.name}
                    onBlur={(e) => updateService(svc.id, { name: e.target.value })}
                    disabled={savingId === svc.id}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={15}
                    defaultValue={svc.base_minutes ?? 60}
                    onBlur={(e) => updateService(svc.id, { base_minutes: Number(e.target.value) })}
                    disabled={savingId === svc.id}
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    defaultValue={svc.price_cents ?? undefined}
                    onBlur={(e) => updateService(svc.id, { price_cents: e.target.value ? Number(e.target.value) : null })}
                    disabled={savingId === svc.id}
                    className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-500">{savingId === svc.id ? 'Saving…' : ''}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => removeService(svc.id)}
                    disabled={savingId === svc.id}
                    className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!services.length && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-sm text-slate-600">
                  No services found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
