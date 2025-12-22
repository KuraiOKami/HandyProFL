'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatTime } from '@/lib/formatting';

type Job = {
  id: string;
  request_id: string;
  service_type: string;
  preferred_date: string;
  preferred_time: string;
  estimated_minutes: number;
  details: string | null;
  status: string;
  cancellation_reason?: string | null;
  customer_name: string;
  customer_phone: string;
  address: string;
  city: string;
  state: string;
  agent_payout_cents: number;
  started_at: string | null;
  completed_at: string | null;
  has_checkin: boolean;
  has_checkout: boolean;
  has_box_photo: boolean;
  has_finished_photo: boolean;
};

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {active ? '✓' : '○'} {label}
    </div>
  );
}

export default function AgentJobsContent() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'upcoming' | 'in_progress' | 'submitted' | 'completed' | 'all'>('upcoming');

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agent/jobs');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load jobs');
      }

      setJobs(data.jobs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatServiceType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getFilteredJobs = () => {
    switch (filter) {
      case 'upcoming':
        return jobs.filter((j) => j.status === 'assigned');
      case 'in_progress':
        return jobs.filter((j) => j.status === 'in_progress');
      case 'submitted':
        return jobs.filter((j) => j.status === 'pending_verification');
      case 'completed':
        return jobs.filter((j) => ['verified', 'paid', 'completed'].includes(j.status));
      default:
        return jobs;
    }
  };

  const filteredJobs = getFilteredJobs();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'assigned':
        return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">Upcoming</span>;
      case 'in_progress':
        return <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">In Progress</span>;
      case 'pending_verification':
        return <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">Submitted</span>;
      case 'verified':
        return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">Verified</span>;
      case 'paid':
        return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">Paid</span>;
      case 'completed':
        return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">Completed</span>;
      case 'cancelled':
        return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Cancelled</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700"></div>
          <p className="text-sm text-slate-600">Loading your jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-600">
            {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'}
          </p>
        </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-white p-1">
              {(['upcoming', 'in_progress', 'submitted', 'completed', 'all'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    filter === f
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f === 'upcoming'
                  ? 'Upcoming'
                  : f === 'in_progress'
                    ? 'In Progress'
                    : f === 'submitted'
                      ? 'Submitted'
                      : f === 'completed'
                        ? 'Completed'
                        : 'All'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Jobs List */}
      {filteredJobs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
          <div className="mb-3 text-4xl">📋</div>
          <p className="text-lg font-medium text-slate-900">No jobs found</p>
          <p className="mt-1 text-sm text-slate-500">
            {filter === 'upcoming'
              ? 'Accept some gigs to see them here'
              : filter === 'in_progress'
              ? 'No jobs in progress'
              : filter === 'completed'
              ? 'No completed jobs yet'
              : 'No jobs yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-300 hover:shadow-md"
            >
              <div className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Job Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {formatServiceType(job.service_type)}
                      </h3>
                      {getStatusBadge(job.status)}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {job.customer_name} • {job.city}, {job.state}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <span>📅</span>
                        <span>
                          {new Date(job.preferred_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>🕐</span>
                        <span>{formatTime(job.preferred_time)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>⏱️</span>
                        <span>{formatDuration(job.estimated_minutes)}</span>
                      </div>
                    </div>

                    {job.details && (
                      <p className="mt-3 text-sm text-slate-600 line-clamp-2">{job.details}</p>
                    )}
                  </div>

                  {/* Earnings & Action */}
                  <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                    <div className="text-right">
                      <p className="text-xl font-bold text-emerald-600">{formatCurrency(job.agent_payout_cents)}</p>
                      <p className="text-xs text-slate-500">your earnings</p>
                    </div>
                    <button
                      onClick={() => router.push(`/agent/jobs/${job.id}`)}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {job.status === 'assigned'
                        ? 'Start Job'
                        : job.status === 'in_progress'
                          ? 'Continue'
                          : job.status === 'pending_verification'
                            ? 'Submitted'
                            : job.status === 'cancelled'
                              ? 'Cancelled'
                              : 'View Details'}
                    </button>
                  </div>
                </div>

                {/* Progress Indicators */}
                {['in_progress', 'pending_verification', 'verified', 'paid', 'completed'].includes(job.status) && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Progress</p>
                    <div className="flex flex-wrap gap-3">
                      <StatusPill label="Checked In" active={job.has_checkin || job.status !== 'assigned'} />
                      <StatusPill label="Box Photo" active={job.has_box_photo || job.status !== 'assigned'} />
                      <StatusPill label="Finished Photo" active={job.has_finished_photo || ['pending_verification', 'verified', 'paid', 'completed'].includes(job.status)} />
                      <StatusPill label="Checked Out" active={job.has_checkout || ['pending_verification', 'verified', 'paid', 'completed'].includes(job.status)} />
                      <StatusPill label="Verified" active={['verified', 'paid', 'completed'].includes(job.status)} />
                      <StatusPill label="Paid" active={['paid', 'completed'].includes(job.status)} />
                      <StatusPill label="Done" active={job.status === 'completed'} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
