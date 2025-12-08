'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import AdminRequestsTableEnhanced from '../AdminRequestsTableEnhanced';

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

export default function AdminRequestsContent() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRequests = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError('Supabase not configured');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('service_requests')
        .select('id, user_id, service_type, preferred_date, preferred_time, details, status, estimated_minutes, created_at')
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setRequests(data ?? []);
      }
      setLoading(false);
    };

    loadRequests();
  }, []);

  if (loading) {
    return (
      <section className="grid gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
          <h2 className="text-xl font-semibold text-slate-900">Requests</h2>
          <p className="text-sm text-slate-600">Search, filter, and manage all client requests.</p>
        </div>
        <p className="text-sm text-slate-600">Loading requests...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="grid gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
          <h2 className="text-xl font-semibold text-slate-900">Requests</h2>
          <p className="text-sm text-slate-600">Search, filter, and manage all client requests.</p>
        </div>
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      </section>
    );
  }

  return <AdminRequestsTableEnhanced initial={requests} />;
}
