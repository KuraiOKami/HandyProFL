'use client';

import { useState } from 'react';

type Service = {
  id: string;
  name: string | null;
  category: string | null;
  general_skill?: string | null;
  icon: string | null;
  base_minutes: number | null;
  price_cents?: number | null;
  is_active?: boolean;
  display_order?: number | null;
};

export default function AdminServicesTable({ initial }: { initial: Service[] }) {
  const [services, setServices] = useState<Service[]>(initial);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newService, setNewService] = useState<Service>({
    id: '',
    name: '',
    category: 'general',
    general_skill: 'general',
    icon: '🔧',
    base_minutes: 60,
    price_cents: null,
    is_active: true,
  });
  const [showAddForm, setShowAddForm] = useState(false);

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
      body: JSON.stringify({
        ...newService,
        price_cents: newService.price_cents != null ? Math.round(Number(newService.price_cents)) : null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Failed to add service.');
      setSavingId(null);
      return;
    }
    setServices((prev) => [...prev, newService]);
    setNewService({
      id: '',
      name: '',
      category: 'general',
      general_skill: 'general',
      icon: '🔧',
      base_minutes: 60,
      price_cents: null,
      is_active: true,
    });
    setShowAddForm(false);
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

  const toggleActive = async (id: string, currentStatus: boolean) => {
    await updateService(id, { is_active: !currentStatus });
  };

  // Group services by category
  const categories = [...new Set(services.map((s) => s.category || 'general'))].sort();

  return (
    <div className="grid gap-4">
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {/* Add Service Button / Form */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600"
        >
          <span className="text-lg">+</span> Add New Service
        </button>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Add New Service</h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Service ID</label>
              <input
                type="text"
                placeholder="e.g., pool_cleaning"
                value={newService.id}
                onChange={(e) => setNewService((p) => ({ ...p, id: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Display Name</label>
              <input
                type="text"
                placeholder="e.g., Pool Cleaning"
                value={newService.name ?? ''}
                onChange={(e) => setNewService((p) => ({ ...p, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Category</label>
              <input
                type="text"
                placeholder="e.g., outdoor"
                value={newService.category ?? ''}
                onChange={(e) => setNewService((p) => ({ ...p, category: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">General Skill</label>
              <input
                type="text"
                placeholder="e.g., plumbing"
                value={newService.general_skill ?? ''}
                onChange={(e) => setNewService((p) => ({ ...p, general_skill: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Icon</label>
              <input
                type="text"
                placeholder="Emoji icon"
                value={newService.icon ?? ''}
                onChange={(e) => setNewService((p) => ({ ...p, icon: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Base Minutes</label>
              <input
                type="number"
                min={15}
                value={newService.base_minutes ?? 60}
                onChange={(e) => setNewService((p) => ({ ...p, base_minutes: Number(e.target.value) }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Price ($)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={newService.price_cents != null ? (newService.price_cents / 100).toFixed(2) : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const cents = val ? Math.round(parseFloat(val) * 100) : null;
                  setNewService((p) => ({ ...p, price_cents: cents ?? null }));
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={addService}
              disabled={savingId === 'new'}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300"
            >
              {savingId === 'new' ? 'Adding...' : 'Add Service'}
            </button>
          </div>
        </div>
      )}

      {/* Services by Category */}
      {categories.map((category) => {
        const categoryServices = services.filter((s) => (s.category || 'general') === category);
        if (categoryServices.length === 0) return null;

        return (
          <div key={category} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {category}
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {categoryServices.map((svc) => (
                <div
                  key={svc.id}
                  className={`flex items-center gap-4 px-5 py-3 ${
                    svc.is_active === false ? 'opacity-50' : ''
                  }`}
                >
                  {/* Icon */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xl">
                    {svc.icon || '🔧'}
                  </div>

                  {/* Service Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        defaultValue={svc.name ?? ''}
                        onBlur={(e) => {
                          if (e.target.value !== svc.name) {
                            updateService(svc.id, { name: e.target.value });
                          }
                        }}
                        disabled={savingId === svc.id}
                        className="w-full max-w-xs rounded border border-transparent px-2 py-1 text-sm font-medium text-slate-900 hover:border-slate-200 focus:border-indigo-500 focus:outline-none"
                      />
                      {svc.is_active === false && (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-slate-400">{svc.id}</p>
                    <input
                      type="text"
                      defaultValue={svc.general_skill ?? ''}
                      onBlur={(e) => {
                        if (e.target.value !== svc.general_skill) {
                          updateService(svc.id, { general_skill: e.target.value });
                        }
                      }}
                      disabled={savingId === svc.id}
                      placeholder="General skill"
                      className="mt-2 w-full max-w-xs rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Minutes */}
                  <div className="w-20">
                    <input
                      type="number"
                      min={15}
                      defaultValue={svc.base_minutes ?? 60}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (val !== svc.base_minutes) {
                          updateService(svc.id, { base_minutes: val });
                        }
                      }}
                      disabled={savingId === svc.id}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-center text-sm focus:border-indigo-500 focus:outline-none"
                    />
                    <p className="text-center text-xs text-slate-400">min</p>
                  </div>

                  {/* Price */}
                  <div className="w-24">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        defaultValue={svc.price_cents != null ? (svc.price_cents / 100).toFixed(2) : ''}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          const cents = val ? Math.round(parseFloat(val) * 100) : null;
                          if (cents !== svc.price_cents) {
                            updateService(svc.id, { price_cents: cents });
                          }
                        }}
                        disabled={savingId === svc.id}
                        className="w-full rounded border border-slate-200 py-1 pl-6 pr-2 text-right text-sm focus:border-indigo-500 focus:outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(svc.id, svc.is_active !== false)}
                      disabled={savingId === svc.id}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        svc.is_active === false
                          ? 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {svc.is_active === false ? 'Activate' : 'Deactivate'}
                    </button>
                    <button
                      onClick={() => removeService(svc.id)}
                      disabled={savingId === svc.id}
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                    {savingId === svc.id && (
                      <span className="text-xs text-slate-400">Saving...</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {services.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
          <p className="text-sm text-slate-500">No services in catalog. Add your first service above.</p>
        </div>
      )}
    </div>
  );
}
