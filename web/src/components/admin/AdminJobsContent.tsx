'use client';

import { useEffect, useState } from 'react';
import { formatTime, formatCurrency } from '@/lib/formatting';
import Image from 'next/image';

type Job = {
  id: string;
  request_id: string;
  service_type: string;
  preferred_date: string;
  preferred_time: string;
  estimated_minutes: number;
  status: string;
  agent_id: string;
  agent_name: string;
  customer_name: string;
  customer_city: string;
  customer_state: string;
  agent_payout_cents: number;
  job_price_cents: number;
  platform_fee_cents: number;
  assigned_at: string | null;
  started_at: string | null;
  checked_out_at: string | null;
  verified_at: string | null;
  paid_at: string | null;
  completed_at: string | null;
  has_box_photo: boolean;
  has_finished_photo: boolean;
};

type JobDetail = {
  job: {
    id: string;
    status: string;
    agent_payout_cents: number;
    job_price_cents: number;
    platform_fee_cents: number;
    verification_notes?: string;
    rejection_notes?: string;
    service_requests: {
      service_type: string;
      preferred_date: string;
      preferred_time: string;
      estimated_minutes: number;
      details: string | null;
      profiles: {
        first_name: string;
        last_name: string;
        phone: string;
        email: string;
        street: string;
        city: string;
        state: string;
        postal_code: string;
      };
    };
  };
  agent: {
    name: string;
    email: string;
    phone: string;
  } | null;
  checkins: Array<{
    type: string;
    created_at: string;
    latitude: number | null;
    longitude: number | null;
    location_verified: boolean;
  }>;
  proofs: Array<{
    id: string;
    type: string;
    photo_url: string;
    notes: string | null;
    uploaded_at: string;
  }>;
};

type Stats = {
  pending_verification: number;
  verified: number;
  paid: number;
  completed: number;
  in_progress: number;
  assigned: number;
};

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  assigned: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  pending_verification: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  verified: { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  paid: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  cancelled: { bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' },
};

export default function AdminJobsContent() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('pending_verification');
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/jobs');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load jobs');
      }

      setJobs(data.jobs || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const loadJobDetail = async (jobId: string) => {
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}/verify`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load job details');
      }

      setSelectedJob(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job details');
    }
  };

  const handleAction = async (jobId: string, action: string, notes?: string) => {
    setActionLoading(action);
    setError(null);

    try {
      const res = await fetch(`/api/admin/jobs/${jobId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Failed to ${action} job`);
      }

      // Refresh jobs list
      await loadJobs();

      // Close modal if open
      if (selectedJob) {
        setSelectedJob(null);
      }

      setVerificationNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} job`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (filter === 'all') return true;
    if (filter === 'needs_action') {
      return ['pending_verification', 'verified'].includes(job.status);
    }
    return job.status === filter;
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.assigned;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-700"></div>
          <p className="text-sm text-slate-600">Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <button
            onClick={() => setFilter('pending_verification')}
            className={`rounded-xl border p-4 text-left transition hover:shadow-md ${
              filter === 'pending_verification' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pending Review</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pending_verification}</p>
          </button>
          <button
            onClick={() => setFilter('verified')}
            className={`rounded-xl border p-4 text-left transition hover:shadow-md ${
              filter === 'verified' ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Verified</p>
            <p className="text-2xl font-bold text-indigo-600">{stats.verified}</p>
          </button>
          <button
            onClick={() => setFilter('paid')}
            className={`rounded-xl border p-4 text-left transition hover:shadow-md ${
              filter === 'paid' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Paid</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.paid}</p>
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`rounded-xl border p-4 text-left transition hover:shadow-md ${
              filter === 'completed' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Completed</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
          </button>
          <button
            onClick={() => setFilter('in_progress')}
            className={`rounded-xl border p-4 text-left transition hover:shadow-md ${
              filter === 'in_progress' ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">{stats.in_progress}</p>
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`rounded-xl border p-4 text-left transition hover:shadow-md ${
              filter === 'all' ? 'border-slate-400 bg-slate-100' : 'border-slate-200 bg-white'
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">All Jobs</p>
            <p className="text-2xl font-bold text-slate-600">{jobs.length}</p>
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Jobs List */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {filter === 'all' ? 'All Jobs' : filter === 'needs_action' ? 'Needs Action' : filter.replace(/_/g, ' ')}
              </h3>
              <p className="text-sm text-slate-500">{filteredJobs.length} jobs</p>
            </div>
            <button
              onClick={loadJobs}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-slate-500">No jobs in this category</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-slate-900">{job.service_type}</h4>
                    {getStatusBadge(job.status)}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {job.customer_name} in {job.customer_city}, {job.customer_state}
                  </p>
                  <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
                    <span>Agent: {job.agent_name}</span>
                    <span>Date: {new Date(job.preferred_date).toLocaleDateString()}</span>
                    <span>Time: {formatTime(job.preferred_time)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(job.job_price_cents)}</p>
                    <p className="text-xs text-slate-500">Agent: {formatCurrency(job.agent_payout_cents)}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {job.status === 'pending_verification' && (
                      <>
                        <button
                          onClick={() => loadJobDetail(job.id)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => handleAction(job.id, 'verify')}
                          disabled={actionLoading !== null}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {actionLoading === 'verify' ? 'Verifying...' : 'Verify'}
                        </button>
                      </>
                    )}
                    {job.status === 'verified' && (
                      <button
                        onClick={() => handleAction(job.id, 'pay')}
                        disabled={actionLoading !== null}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {actionLoading === 'pay' ? 'Processing...' : 'Mark Paid'}
                      </button>
                    )}
                    {job.status === 'paid' && (
                      <button
                        onClick={() => handleAction(job.id, 'complete')}
                        disabled={actionLoading !== null}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {actionLoading === 'complete' ? 'Completing...' : 'Complete'}
                      </button>
                    )}
                    {!['pending_verification', 'verified', 'paid'].includes(job.status) && (
                      <button
                        onClick={() => loadJobDetail(job.id)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedJob(null)}>
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Job Review
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedJob.job.service_requests?.service_type || 'Service'}
                </p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="grid gap-6 p-6 lg:grid-cols-2">
              {/* Left Column - Photos */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Proof of Work</h3>
                {selectedJob.proofs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
                    <p className="text-sm text-slate-500">No photos uploaded</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {selectedJob.proofs.map((proof) => (
                      <div key={proof.id} className="space-y-2">
                        <p className="text-xs font-medium text-slate-600">
                          {proof.type === 'box' ? 'Before (Box/Materials)' : 'After (Completed Work)'}
                        </p>
                        <div className="relative h-64 w-full overflow-hidden rounded-lg bg-slate-100">
                          <Image
                            src={proof.photo_url}
                            alt={proof.type}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                        {proof.notes && (
                          <p className="text-xs text-slate-500">{proof.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column - Details */}
              <div className="space-y-6">
                {/* Status & Actions */}
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current Status</p>
                      <div className="mt-1">{getStatusBadge(selectedJob.job.status)}</div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Agent Payout</p>
                      <p className="text-lg font-bold text-emerald-600">
                        {formatCurrency(selectedJob.job.agent_payout_cents)}
                      </p>
                    </div>
                  </div>

                  {selectedJob.job.status === 'pending_verification' && (
                    <div className="mt-4 space-y-3">
                      <textarea
                        value={verificationNotes}
                        onChange={(e) => setVerificationNotes(e.target.value)}
                        placeholder="Add verification notes (optional)..."
                        className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(selectedJob.job.id, 'verify', verificationNotes)}
                          disabled={actionLoading !== null}
                          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {actionLoading === 'verify' ? 'Verifying...' : 'Approve & Verify'}
                        </button>
                        <button
                          onClick={() => handleAction(selectedJob.job.id, 'reject', verificationNotes)}
                          disabled={actionLoading !== null}
                          className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          {actionLoading === 'reject' ? 'Rejecting...' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Agent Info */}
                {selectedJob.agent && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Agent</h3>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="font-medium text-slate-900">{selectedJob.agent.name}</p>
                      {selectedJob.agent.email && (
                        <p className="text-sm text-slate-600">{selectedJob.agent.email}</p>
                      )}
                      {selectedJob.agent.phone && (
                        <p className="text-sm text-slate-600">{selectedJob.agent.phone}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Customer Info */}
                {selectedJob.job.service_requests?.profiles && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Customer</h3>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="font-medium text-slate-900">
                        {selectedJob.job.service_requests.profiles.first_name} {selectedJob.job.service_requests.profiles.last_name}
                      </p>
                      <p className="text-sm text-slate-600">
                        {selectedJob.job.service_requests.profiles.street}
                      </p>
                      <p className="text-sm text-slate-600">
                        {selectedJob.job.service_requests.profiles.city}, {selectedJob.job.service_requests.profiles.state} {selectedJob.job.service_requests.profiles.postal_code}
                      </p>
                      {selectedJob.job.service_requests.profiles.phone && (
                        <p className="mt-1 text-sm text-slate-600">{selectedJob.job.service_requests.profiles.phone}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Check-in/out Timeline */}
                {selectedJob.checkins.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Timeline</h3>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <div className="space-y-3">
                        {selectedJob.checkins.map((checkin, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className={`mt-0.5 h-2 w-2 rounded-full ${
                              checkin.type === 'checkin' ? 'bg-blue-500' : 'bg-emerald-500'
                            }`} />
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {checkin.type === 'checkin' ? 'Checked In' : 'Checked Out'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatDate(checkin.created_at)}
                                {checkin.location_verified && ' - Location verified'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Rejection Notes */}
                {selectedJob.job.rejection_notes && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-rose-700">Previous Rejection</p>
                    <p className="mt-1 text-sm text-rose-600">{selectedJob.job.rejection_notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
