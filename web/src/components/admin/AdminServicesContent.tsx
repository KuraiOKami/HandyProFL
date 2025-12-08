'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import AdminServicesTable from '../AdminServicesTable';

type Service = {
  id: string;
  name: string | null;
  base_minutes: number | null;
  price_cents: number | null;
};

export default function AdminServicesContent() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadServices = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError('Supabase not configured');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('service_catalog')
        .select('id, name, base_minutes, price_cents')
        .order('name', { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setServices(data ?? []);
      }
      setLoading(false);
    };

    loadServices();
  }, []);

  if (loading) {
    return (
      <section className="grid gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
          <h2 className="text-xl font-semibold text-slate-900">Services</h2>
          <p className="text-sm text-slate-600">Manage catalog, pricing, and estimated durations.</p>
        </div>
        <p className="text-sm text-slate-600">Loading services...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="grid gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
          <h2 className="text-xl font-semibold text-slate-900">Services</h2>
          <p className="text-sm text-slate-600">Manage catalog, pricing, and estimated durations.</p>
        </div>
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h2 className="text-xl font-semibold text-slate-900">Services</h2>
        <p className="text-sm text-slate-600">Manage catalog, pricing, and estimated durations.</p>
      </div>
      <AdminServicesTable initial={services} />
    </section>
  );
}
