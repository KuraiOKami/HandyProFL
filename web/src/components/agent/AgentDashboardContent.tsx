'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { formatTime } from '@/lib/formatting';

type DashboardStats = {
  pendingJobs: number;
  completedJobs: number;
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  rating: number;
};

type UpcomingJob = {
  id: string;
  request_id: string;
  service_type: string;
  preferred_date: string;
  preferred_time: string;
  status: string;
  customer_name: string;
  city: string;
};

export default function AgentDashboardContent() {
  const [stats, setStats] = useState<DashboardStats>({
    pendingJobs: 0,
    completedJobs: 0,
    totalEarnings: 0,
    availableBalance: 0,
    pendingBalance: 0,
    rating: 5.0,
  });
  const [upcomingJobs, setUpcomingJobs] = useState<UpcomingJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      const supabase = getSupabaseClient();
       if (!supabase) {
         setLoading(false);
         return;
       }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const agentId = session.user.id;

      // Get agent profile for rating
      const { data: agentProfile } = await supabase
        .from('agent_profiles')
        .select('rating, total_jobs, total_earnings_cents')
        .eq('id', agentId)
        .single();

      // Get job counts
      const { data: assignments } = await supabase
        .from('job_assignments')
        .select('id, status')
        .eq('agent_id', agentId);

      const pendingJobs = assignments?.filter((a) => a.status === 'assigned').length || 0;
      const completedJobs = assignments?.filter((a) => a.status === 'completed').length || 0;

      // Get earnings
      const { data: earnings } = await supabase
        .from('agent_earnings')
        .select('amount_cents, status, available_at')
        .eq('agent_id', agentId);

      const now = new Date();
      const availableBalance = earnings
        ?.filter((e) => e.status === 'available' || (e.status === 'pending' && new Date(e.available_at) <= now))
        .reduce((sum, e) => sum + e.amount_cents, 0) || 0;

      const pendingBalance = earnings
        ?.filter((e) => e.status === 'pending' && new Date(e.available_at) > now)
        .reduce((sum, e) => sum + e.amount_cents, 0) || 0;

      const totalEarnings = agentProfile?.total_earnings_cents || 0;

      setStats({
        pendingJobs,
        completedJobs,
        totalEarnings,
        availableBalance,
        pendingBalance,
        rating: agentProfile?.rating || 5.0,
      });

      // Get upcoming jobs with customer info
      const { data: upcomingAssignments } = await supabase
        .from('job_assignments')
        .select(`
          id,
          request_id,
          status,
          service_requests (
            service_type,
            preferred_date,
            preferred_time,
            user_id,
            profiles:user_id (
              first_name,
              last_name,
              city
            )
          )
        `)
        .eq('agent_id', agentId)
        .in('status', ['assigned', 'in_progress'])
        .order('assigned_at', { ascending: true })
        .limit(5);

      const jobs: UpcomingJob[] = (upcomingAssignments || []).map((a: Record<string, unknown>) => {
        const sr = a.service_requests as Record<string, unknown> | null;
        const profile = sr?.profiles as Record<string, unknown> | null;
        return {
          id: a.id as string,
          request_id: a.request_id as string,
          service_type: (sr?.service_type as string) || 'Unknown',
          preferred_date: (sr?.preferred_date as string) || '',
          preferred_time: (sr?.preferred_time as string) || '',
          status: a.status as string,
          customer_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Customer',
          city: (profile?.city as string) || '',
        };
      });

      setUpcomingJobs(jobs);
      setLoading(false);
    };

    loadDashboard();
  }, []);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatServiceType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700"></div>
          <p className="text-sm text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pending Jobs */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Upcoming Jobs</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.pendingJobs}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
              📋
            </div>
          </div>
        </div>

        {/* Completed Jobs */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Completed Jobs</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.completedJobs}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
              ✅
            </div>
          </div>
        </div>

        {/* Available Balance */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Available Balance</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{formatCurrency(stats.availableBalance)}</p>
              {stats.pendingBalance > 0 && (
                <p className="mt-0.5 text-xs text-slate-500">
                  +{formatCurrency(stats.pendingBalance)} pending
                </p>
              )}
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
              💵
            </div>
          </div>
        </div>

        {/* Rating */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Your Rating</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.rating.toFixed(1)}</p>
              <p className="mt-0.5 text-xs text-slate-500">{stats.completedJobs} reviews</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-2xl">
              ⭐
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Jobs Section */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Upcoming Jobs</h3>
          <p className="text-sm text-slate-500">Your next scheduled jobs</p>
        </div>

        {upcomingJobs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="mb-3 text-4xl">🔍</div>
            <p className="text-slate-600">No upcoming jobs</p>
            <p className="mt-1 text-sm text-slate-500">Check available gigs to find your next job</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {upcomingJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xl">
                    🛠️
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{formatServiceType(job.service_type)}</p>
                    <p className="text-sm text-slate-500">
                      {job.customer_name} {job.city && `• ${job.city}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-slate-900">
                    {new Date(job.preferred_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-slate-500">{formatTime(job.preferred_time)}</p>
                </div>
                <span
                  className={`ml-4 rounded-full px-2.5 py-1 text-xs font-medium ${
                    job.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {job.status === 'in_progress' ? 'In Progress' : 'Assigned'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <a
          href="/agent?tab=gigs"
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
            🔍
          </div>
          <div>
            <p className="font-semibold text-slate-900">Find Gigs</p>
            <p className="text-sm text-slate-500">Browse available jobs nearby</p>
          </div>
        </a>

        <a
          href="/agent?tab=earnings"
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
            💰
          </div>
          <div>
            <p className="font-semibold text-slate-900">Cash Out</p>
            <p className="text-sm text-slate-500">Transfer your earnings</p>
          </div>
        </a>

        <a
          href="/agent?tab=settings"
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl">
            ⚙️
          </div>
          <div>
            <p className="font-semibold text-slate-900">Settings</p>
            <p className="text-sm text-slate-500">Update your profile</p>
          </div>
        </a>
      </div>
    </div>
  );
}
