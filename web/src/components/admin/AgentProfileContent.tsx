'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Agent = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  bio: string;
  photo_url: string | null;
  selfie_url: string | null;
  status: string;
  tier: string;
  rating: number;
  rating_count: number;
  total_jobs: number;
  total_earnings_cents: number;
  service_area_miles: number;
  auto_booking_enabled: boolean;
  location_latitude: number | null;
  location_longitude: number | null;
  stripe_account_id: string | null;
  stripe_account_status: string;
  stripe_payouts_enabled: boolean;
  stripe_charges_enabled: boolean;
  instant_payout_enabled: boolean;
  identity_verification_status: string;
  identity_verified_at: string | null;
  admin_notes: string;
  created_at: string;
  updated_at: string | null;
};

type Skill = {
  service_id: string;
  proficiency_level: string;
  years_experience: number;
  certified: boolean;
  service_name: string;
  service_category: string;
  service_icon: string;
};

type Job = {
  id: string;
  request_id: string | null;
  service_type: string;
  preferred_date: string | null;
  preferred_time: string | null;
  request_status: string | null;
  job_status: string;
  total_price_cents: number;
  payout_cents: number;
  created_at: string;
  completed_at: string | null;
};

type Payout = {
  id: string;
  amount_cents: number;
  status: string;
  created_at: string;
  method: string;
};

type Review = {
  id: string;
  rating: number;
  review: string | null;
  created_at: string;
  job_assignment_id: string | null;
  rater_name: string;
};
type Tab = 'profile' | 'activity' | 'reviews' | 'documents' | 'messaging' | 'notes' | 'support';

export default function AgentProfileContent({ agentId }: { agentId: string }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Notes state
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSuccess, setNotesSuccess] = useState(false);

  const loadAgent = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/agents/${agentId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load agent');
      }

      setAgent(data.agent);
      setSkills(data.skills || []);
      setJobs(data.jobs || []);
      setPayouts(data.payouts || []);
      setReviews(data.reviews || []);
      setNotes(data.agent.admin_notes || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  const handleApprove = async () => {
    setActionLoading(true);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}/approve`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve');
      }
      setActionSuccess('Agent approved successfully');
      await loadAgent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async () => {
    setActionLoading(true);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}/suspend`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to suspend');
      }
      setActionSuccess('Agent suspended');
      await loadAgent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suspend');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    setNotesSuccess(false);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_notes: notes }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save notes');
      }
      setNotesSuccess(true);
      setTimeout(() => setNotesSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setNotesSaving(false);
    }
  };

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">Approved</span>;
      case 'pending_approval':
        return <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">Pending Approval</span>;
      case 'suspended':
        return <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-700">Suspended</span>;
      default:
        return null;
    }
  };

  const getIdentityBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">ID Verified</span>;
      case 'pending':
        return <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">ID Pending</span>;
      default:
        return <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">ID Not Started</span>;
    }
  };

  const getTierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: 'bg-amber-100 text-amber-800',
      silver: 'bg-slate-200 text-slate-700',
      gold: 'bg-yellow-100 text-yellow-800',
      platinum: 'bg-indigo-100 text-indigo-800',
    };
    return (
      <span className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${colors[tier] || colors.bronze}`}>
        {tier}
      </span>
    );
  };

  const getJobStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-emerald-100 text-emerald-700',
      in_progress: 'bg-blue-100 text-blue-700',
      accepted: 'bg-indigo-100 text-indigo-700',
      assigned: 'bg-indigo-100 text-indigo-700',
      cancelled: 'bg-rose-100 text-rose-700',
      pending: 'bg-amber-100 text-amber-700',
    };
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-600'}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-700"></div>
          <p className="text-sm text-slate-600">Loading agent profile...</p>
        </div>
      </div>
    );
  }

  if (error && !agent) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Link href="/admin?tab=agents" className="mb-4 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
          &larr; Back to Agents
        </Link>
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700">{error}</div>
      </div>
    );
  }

  if (!agent) return null;

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'activity', label: 'Activity', icon: '📋' },
    { id: 'reviews', label: 'Reviews', icon: '⭐' },
    { id: 'documents', label: 'Documents', icon: '📄' },
    { id: 'messaging', label: 'Messages', icon: '💬' },
    { id: 'notes', label: 'Notes', icon: '📝' },
    { id: 'support', label: 'Support', icon: '🛠️' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <Link href="/admin?tab=agents" className="mb-4 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
            &larr; Back to Agents
          </Link>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              {agent.selfie_url || agent.photo_url ? (
                <img
                  src={agent.selfie_url || agent.photo_url || ''}
                  alt={`${agent.first_name} ${agent.last_name}`}
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-slate-200"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-600">
                  {agent.first_name[0]}{agent.last_name[0]}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {agent.first_name} {agent.last_name}
                </h1>
                <p className="text-sm text-slate-500">{agent.email}</p>
                {agent.phone && <p className="text-sm text-slate-500">{agent.phone}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {getStatusBadge(agent.status)}
                  {getIdentityBadge(agent.identity_verification_status)}
                  {getTierBadge(agent.tier)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {agent.status === 'pending_approval' && (
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-400"
                >
                  {actionLoading ? 'Approving...' : 'Approve Agent'}
                </button>
              )}
              {agent.status === 'approved' && (
                <button
                  onClick={handleSuspend}
                  disabled={actionLoading}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:bg-rose-400"
                >
                  {actionLoading ? 'Suspending...' : 'Suspend Agent'}
                </button>
              )}
              {agent.status === 'suspended' && (
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-400"
                >
                  {actionLoading ? 'Reactivating...' : 'Reactivate Agent'}
                </button>
              )}
            </div>
          </div>

          {(actionSuccess || error) && (
            <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${actionSuccess ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {actionSuccess || error}
            </div>
          )}
        </div>
      </div>

      {/* Summary Strip */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Jobs</p>
              <p className="text-xl font-bold text-slate-900">{agent.total_jobs}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Earnings</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(agent.total_earnings_cents)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Rating</p>
              <p className="text-xl font-bold text-slate-900">
                <span className="text-yellow-500">⭐</span> {agent.rating.toFixed(1)}
                <span className="text-sm font-normal text-slate-500"> ({agent.rating_count})</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Payouts</p>
              <p className="text-xl font-bold text-slate-900">
                {agent.stripe_payouts_enabled ? (
                  <span className="text-emerald-600">Enabled</span>
                ) : (
                  <span className="text-slate-400">Not Setup</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Joined</p>
              <p className="text-xl font-bold text-slate-900">{formatDate(agent.created_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <nav className="-mb-px flex gap-4 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Contact Info */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Contact Information</h3>
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Email</p>
                  <p className="text-sm text-slate-900">{agent.email}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Phone</p>
                  <p className="text-sm text-slate-900">{agent.phone || 'Not provided'}</p>
                </div>
                {agent.location_latitude && agent.location_longitude && (
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-500">Location</p>
                    <p className="text-sm text-slate-900">
                      {agent.location_latitude.toFixed(4)}, {agent.location_longitude.toFixed(4)}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Service Radius</p>
                  <p className="text-sm text-slate-900">{agent.service_area_miles} miles</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Auto-Booking</p>
                  <p className="text-sm text-slate-900">{agent.auto_booking_enabled ? 'Enabled' : 'Disabled'}</p>
                </div>
              </div>
            </div>

            {/* Skills */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Skills & Services</h3>
              {skills.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No skills configured</p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <div
                      key={skill.service_id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <span>{skill.service_icon}</span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{skill.service_name}</p>
                        <p className="text-xs text-slate-500">
                          {skill.proficiency_level} · {skill.years_experience}y exp
                          {skill.certified && ' · Certified'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Status */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Payment Connection</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">Stripe Account</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    agent.stripe_account_status === 'enabled' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {agent.stripe_account_status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">Payouts Enabled</p>
                  <span className={`text-sm font-medium ${agent.stripe_payouts_enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {agent.stripe_payouts_enabled ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">Instant Payouts</p>
                  <span className={`text-sm font-medium ${agent.instant_payout_enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {agent.instant_payout_enabled ? 'Enabled' : 'Not Available'}
                  </span>
                </div>
                {agent.stripe_account_id && (
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-500">Account ID</p>
                    <p className="font-mono text-xs text-slate-600">{agent.stripe_account_id}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Bio</h3>
              <p className="mt-4 text-sm text-slate-600">
                {agent.bio || 'No bio provided'}
              </p>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Jobs */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h3 className="text-lg font-semibold text-slate-900">Recent Jobs</h3>
              {jobs.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No jobs yet</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">Service</th>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">Status</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase text-slate-500">Payout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {jobs.map((job) => (
                        <tr key={job.id} className="hover:bg-slate-50">
                          <td className="px-3 py-3">
                            <p className="text-sm font-medium text-slate-900">{job.service_type}</p>
                            <p className="text-xs text-slate-500">{job.id.slice(0, 8)}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-sm text-slate-900">{formatDate(job.preferred_date)}</p>
                            <p className="text-xs text-slate-500">{formatTime(job.preferred_time)}</p>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-1">
                              {getJobStatusBadge(job.job_status)}
                              {job.request_status && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                  Request: {job.request_status}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <p className="text-sm font-medium text-slate-900">{formatCurrency(job.payout_cents)}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Payouts */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h3 className="text-lg font-semibold text-slate-900">Recent Payouts</h3>
              {payouts.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No payouts yet</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {payouts.map((payout) => (
                    <div key={payout.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{formatCurrency(payout.amount_cents)}</p>
                        <p className="text-xs text-slate-500">{formatDate(payout.created_at)} · {payout.method}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        payout.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {payout.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="grid gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Average Rating</p>
                  <p className="text-2xl font-bold text-slate-900">
                    <span className="text-yellow-500">⭐</span> {agent.rating.toFixed(1)}
                    <span className="text-sm font-normal text-slate-500"> ({agent.rating_count} reviews)</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Client Reviews</h3>
              {reviews.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No reviews yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg text-yellow-500">⭐</span>
                          <span className="text-sm font-semibold text-slate-900">{review.rating.toFixed(1)}</span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {formatDate(review.created_at)} {review.job_assignment_id ? `· Job ${review.job_assignment_id.slice(0, 8)}` : ''}
                        </span>
                      </div>
                      {review.review && <p className="mt-2 text-sm text-slate-700">{review.review}</p>}
                      <p className="mt-1 text-xs text-slate-500">From: {review.rater_name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Documents Tab (Stub) */}
        {activeTab === 'documents' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Documents</h3>
            <p className="mt-2 text-sm text-slate-500">ID verification and tax documents</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {/* ID Verification */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Identity Verification</p>
                    <p className="text-xs text-slate-500">
                      {agent.identity_verification_status === 'verified'
                        ? `Verified on ${formatDate(agent.identity_verified_at)}`
                        : 'Not verified'}
                    </p>
                  </div>
                  {getIdentityBadge(agent.identity_verification_status)}
                </div>
                {agent.selfie_url && (
                  <a
                    href={agent.selfie_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                  >
                    View Selfie &rarr;
                  </a>
                )}
              </div>

              {/* W-9 Placeholder */}
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">W-9 Form</p>
                <p className="text-xs text-slate-500">Tax form for 1099 reporting</p>
                <button className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                  Request W-9
                </button>
              </div>

              {/* 1099 Placeholder */}
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">1099-NEC</p>
                <p className="text-xs text-slate-500">Annual earnings report</p>
                <button className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                  Generate 1099
                </button>
              </div>

              {/* Background Check Placeholder */}
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">Background Check</p>
                <p className="text-xs text-slate-500">Third-party verification</p>
                <button className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                  Request Check
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messaging Tab (Stub) */}
        {activeTab === 'messaging' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Messages</h3>
            <p className="mt-2 text-sm text-slate-500">Communication history with this agent</p>

            <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <div className="mb-3 text-4xl">💬</div>
              <p className="text-sm font-medium text-slate-900">Messaging Coming Soon</p>
              <p className="mt-1 text-xs text-slate-500">
                Direct messaging with agents will be available here
              </p>
              <button className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Open Messages
              </button>
            </div>
          </div>
        )}

        {/* Support Tab */}
        {activeTab === 'support' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Agent Care</h3>
              <p className="mt-2 text-sm text-slate-500">
                Quick actions to help this agent when they reach out with questions.
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <a className="block rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50" href={`mailto:${agent.email}?subject=Support%20for%20${encodeURIComponent(agent.first_name + ' ' + agent.last_name)}`}>
                  Email agent ({agent.email})
                </a>
                {agent.phone && (
                  <a className="block rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50" href={`tel:${agent.phone}`}>
                    Call agent ({agent.phone})
                  </a>
                )}
                <a className="block rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50" href={`/admin?tab=messages&agent=${agent.id}`}>
                  Open admin messages
                </a>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Client Care & Escalations</h3>
              <p className="mt-2 text-sm text-slate-500">
                Use when the agent needs help with a client or job.
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <a className="block rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50" href={`mailto:support@handyprofl.com?subject=Agent%20Escalation%20${encodeURIComponent(agent.first_name + ' ' + agent.last_name)}`}>
                  Email agent care (support@handyprofl.com)
                </a>
                <a className="block rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50" href={`/admin?tab=requests&agent=${agent.id}`}>
                  View agent’s jobs/requests
                </a>
                <div className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-xs text-slate-600">
                  Tip: log summaries of calls/chats in Notes for future context.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Admin Notes</h3>
            <p className="mt-2 text-sm text-slate-500">Internal notes about this agent (not visible to agent)</p>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={8}
              placeholder="Add notes about this agent..."
              className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleSaveNotes}
                disabled={notesSaving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-400"
              >
                {notesSaving ? 'Saving...' : 'Save Notes'}
              </button>
              {notesSuccess && (
                <span className="text-sm text-emerald-600">Notes saved successfully!</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
