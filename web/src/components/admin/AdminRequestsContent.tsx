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
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
          <p className="text-sm text-slate-600">Loading requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
        <p className="text-sm text-rose-700">{error}</p>
      </div>
    );
  }

  return <AdminRequestsTableEnhanced initial={requests} />;
}
