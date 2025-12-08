'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

type Stats = {
  pendingCount: number;
  todaysCount: number;
  newClientsCount: number;
  error: string | null;
};

export default function AdminDashboardContent() {
  const [stats, setStats] = useState<Stats>({
    pendingCount: 0,
    todaysCount: 0,
    newClientsCount: 0,
    error: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setStats(prev => ({ ...prev, error: 'Supabase not configured' }));
        setLoading(false);
        return;
      }

      const today = new Date();
      const todayISODate = today.toISOString().slice(0, 10);
      const startOfWeek = new Date();
      startOfWeek.setDate(today.getDate() - 6);
      const startOfWeekISO = startOfWeek.toISOString();

      try {
        const [{ count: pendingCount }, { count: todaysCount }, { count: newClientsCount }] = await Promise.all([
          supabase.from('service_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('service_requests').select('id', { count: 'exact', head: true }).eq('preferred_date', todayISODate),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .gte('updated_at', startOfWeekISO)
            .lte('updated_at', today.toISOString()),
        ]);

        setStats({
          pendingCount: pendingCount ?? 0,
          todaysCount: todaysCount ?? 0,
          newClientsCount: newClientsCount ?? 0,
          error: null,
        });
      } catch (err) {
        setStats(prev => ({ ...prev, error: 'Failed to load stats' }));
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const cards = [
    { title: 'Pending requests', value: stats.pendingCount },
    { title: "Today's appointments", value: stats.todaysCount },
    { title: 'New clients this week', value: stats.newClientsCount },
  ];

  return (
    <section className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h2 className="text-xl font-semibold text-slate-900">Dashboard</h2>
        <p className="text-sm text-slate-600">Snapshot of requests, clients, and schedule.</p>
      </div>
      {loading ? (
        <p className="text-sm text-slate-600">Loading stats...</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {cards.map((card) => (
              <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-slate-600">{card.title}</p>
                <p className="text-2xl font-semibold text-slate-900">{card.value}</p>
              </div>
            ))}
          </div>
          {stats.error && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {stats.error}. Ensure the SUPABASE_SERVICE_ROLE_KEY is set for admin dashboard queries.
            </p>
          )}
        </>
      )}
    </section>
  );
}
