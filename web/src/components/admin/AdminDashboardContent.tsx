'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { formatTime } from '@/lib/formatting';

type Stats = {
  pendingCount: number;
  todaysCount: number;
  newClientsCount: number;
  error: string | null;
};

type RequestSummary = {
  id: string;
  service_type: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  status: string | null;
  created_at: string | null;
};

export default function AdminDashboardContent() {
  const [stats, setStats] = useState<Stats>({
    pendingCount: 0,
    todaysCount: 0,
    newClientsCount: 0,
    error: null,
  });
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<RequestSummary[]>([]);

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
        const [
          { count: pendingCount },
          { count: todaysCount },
          { count: newClientsCount },
          { data: pendingList },
        ] = await Promise.all([
          supabase.from('service_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('service_requests').select('id', { count: 'exact', head: true }).eq('preferred_date', todayISODate),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .gte('updated_at', startOfWeekISO)
            .lte('updated_at', today.toISOString()),
          supabase
            .from('service_requests')
            .select('id, service_type, preferred_date, preferred_time, status, created_at')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        setStats({
          pendingCount: pendingCount ?? 0,
          todaysCount: todaysCount ?? 0,
          newClientsCount: newClientsCount ?? 0,
          error: null,
        });
        setPendingRequests(pendingList ?? []);
      } catch {
        setStats(prev => ({ ...prev, error: 'Failed to load stats' }));
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return 'No date';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatRelative = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDateShort(dateStr);
  };

  const unscheduledCount = pendingRequests.filter((req) => !req.preferred_date || !req.preferred_time).length;

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

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">New requests</p>
                  <h3 className="text-lg font-semibold text-slate-900">Review & confirm</h3>
                  <p className="text-sm text-slate-600">Fast lane from client request to confirmation.</p>
                </div>
                <Link
                  href="/admin?tab=requests"
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  Open Requests
                </Link>
              </div>
              <div className="mt-4 space-y-3">
                {pendingRequests.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                    No new requests waiting for confirmation.
                  </div>
                )}
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {req.service_type || 'Service request'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Requested {formatRelative(req.created_at)} · {req.id.slice(0, 8)}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                        Pending
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                      <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                        {req.preferred_date ? formatDateShort(req.preferred_date) : 'Needs date'}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                        {formatTime(req.preferred_time) || 'Pick time'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Reminders</p>
              <h3 className="text-lg font-semibold text-slate-900">Keep clients moving</h3>
              <div className="mt-3 space-y-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Confirm pending</p>
                      <p className="text-xs text-slate-500">Approve or schedule new requests.</p>
                    </div>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      {stats.pendingCount}
                    </span>
                  </div>
                  <Link href="/admin?tab=requests" className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                    Go to Kanban →
                  </Link>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Assign time slots</p>
                      <p className="text-xs text-slate-500">Pending with missing date/time.</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {unscheduledCount}
                    </span>
                  </div>
                  <Link href="/admin?tab=requests" className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                    Set schedule →
                  </Link>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Prep for today</p>
                      <p className="text-xs text-slate-500">Double-check today&apos;s visits.</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {stats.todaysCount}
                    </span>
                  </div>
                  <Link href="/admin?tab=schedule" className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                    Review schedule →
                  </Link>
                </div>
              </div>
            </div>
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
