'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { formatTime } from '@/lib/formatting';
import JobChat from '@/components/chat/JobChat';

// Note: Link removed - using embedded JobChat instead of linking to dashboard messages

type Booking = {
  id: string;
  serviceType: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  details: string | null;
  status: string | null;
  createdAt: string | null;
  totalPriceCents: number | null;
  laborPriceCents: number | null;
  materialsCostCents: number | null;
  urgencyFeeCents: number | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  assignedAgentId: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancellationFeeCents: number | null;
};

type AgentProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  rating: number | null;
  total_jobs: number | null;
  tier: string | null;
} | null;

const TIER_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  bronze: { label: 'Bronze', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: '🥉' },
  silver: { label: 'Silver', color: 'text-slate-600', bgColor: 'bg-slate-200', icon: '🥈' },
  gold: { label: 'Gold', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: '🥇' },
  platinum: { label: 'Platinum', color: 'text-indigo-700', bgColor: 'bg-indigo-100', icon: '💎' },
};

type JobAssignment = {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
} | null;

type ProofPhoto = {
  id: string;
  type: string;
  photo_url: string;
  notes: string | null;
};

type Props = {
  booking: Booking;
  agentProfile: AgentProfile;
  jobAssignment: JobAssignment;
  proofPhotos: ProofPhoto[];
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; description: string }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bgColor: 'bg-amber-50', description: 'Your request is being reviewed.' },
  confirmed: { label: 'Confirmed', color: 'text-blue-700', bgColor: 'bg-blue-50', description: 'Your booking has been confirmed.' },
  scheduled: { label: 'Scheduled', color: 'text-indigo-700', bgColor: 'bg-indigo-50', description: 'Your appointment is scheduled.' },
  assigned: { label: 'Agent Assigned', color: 'text-purple-700', bgColor: 'bg-purple-50', description: 'An agent has been assigned to your job.' },
  in_progress: { label: 'In Progress', color: 'text-cyan-700', bgColor: 'bg-cyan-50', description: 'Your agent is currently working on your job.' },
  pending_verification: { label: 'Verifying', color: 'text-orange-700', bgColor: 'bg-orange-50', description: 'Work completed, awaiting verification.' },
  completed: { label: 'Completed', color: 'text-emerald-700', bgColor: 'bg-emerald-50', description: 'Your job has been completed successfully.' },
  cancelled: { label: 'Cancelled', color: 'text-rose-700', bgColor: 'bg-rose-50', description: 'This booking has been cancelled.' },
};

const DISPLAY_TIME_ZONE = 'America/New_York';

function parseBookingDate(value: string) {
  if (value.includes('T')) return new Date(value);
  return new Date(`${value}T12:00:00`);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Not scheduled';
  const date = parseBookingDate(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: DISPLAY_TIME_ZONE,
  }).format(date);
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: DISPLAY_TIME_ZONE,
  }).format(date);
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: DISPLAY_TIME_ZONE,
  }).format(date);
}

function formatPrice(cents: number | null): string {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function computeCancellationFee(
  preferredTime: string | null,
  preferredDate: string | null,
  nowMs: number
) {
  let serviceDate: Date | null = null;

  if (preferredTime) {
    const d = parseBookingDate(preferredTime);
    if (!Number.isNaN(d.getTime())) serviceDate = d;
  }

  if (!serviceDate && preferredDate) {
    const d = parseBookingDate(preferredDate);
    if (!Number.isNaN(d.getTime())) serviceDate = d;
  }

  if (!serviceDate) return 0;
  const diffHours = (serviceDate.getTime() - nowMs) / (1000 * 60 * 60);
  if (diffHours <= 2) return 4000;
  if (diffHours <= 8) return 2000;
  if (diffHours <= 24) return 1000;
  return 0;
}

function getTimeUntilService(
  preferredTime: string | null,
  preferredDate: string | null,
  nowMs: number
): { description: string; diffHours: number } | null {
  let serviceDate: Date | null = null;

  if (preferredTime) {
    const d = parseBookingDate(preferredTime);
    if (!Number.isNaN(d.getTime())) serviceDate = d;
  }

  if (!serviceDate && preferredDate) {
    const d = parseBookingDate(preferredDate);
    if (!Number.isNaN(d.getTime())) serviceDate = d;
  }

  if (!serviceDate) return null;

  const diffMs = serviceDate.getTime() - nowMs;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) {
    return { description: 'past your appointment time', diffHours };
  }

  if (diffHours < 1) {
    const minutes = Math.round(diffHours * 60);
    return { description: `${minutes} minute${minutes !== 1 ? 's' : ''} from your appointment`, diffHours };
  }

  if (diffHours < 24) {
    const hours = Math.round(diffHours);
    return { description: `${hours} hour${hours !== 1 ? 's' : ''} from your appointment`, diffHours };
  }

  const days = Math.round(diffHours / 24);
  return { description: `${days} day${days !== 1 ? 's' : ''} from your appointment`, diffHours };
}

export default function BookingDetailView({ booking, agentProfile, jobAssignment, proofPhotos }: Props) {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [newDate, setNewDate] = useState(booking.preferredDate || '');
  const [newTime, setNewTime] = useState(formatTime(booking.preferredTime) || '');
  const [rescheduling, setRescheduling] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [todayDate, setTodayDate] = useState('');

  // Rating state
  const [hasRated, setHasRated] = useState(false);
  const [existingRating, setExistingRating] = useState<{ rating: number; review: string | null } | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  useEffect(() => {
    const now = Date.now();
    setNowMs(now);
    setTodayDate(new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE }).format(new Date(now)));
  }, []);

  // Check if job has been rated
  useEffect(() => {
    const checkRating = async () => {
      if (booking.status !== 'complete' && booking.status !== 'completed') return;

      try {
        const res = await fetch(`/api/requests/${booking.id}/rate`);
        const data = await res.json();
        if (data.hasRated) {
          setHasRated(true);
          setExistingRating(data.rating);
        }
      } catch (err) {
        console.error('Failed to check rating status:', err);
      }
    };

    checkRating();
  }, [booking.id, booking.status]);

  const handleSubmitRating = async () => {
    if (rating === 0) return;

    setSubmittingRating(true);
    setError(null);

    try {
      const res = await fetch(`/api/requests/${booking.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, review: review.trim() || null }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit rating');
      }

      setHasRated(true);
      setExistingRating({ rating, review: review.trim() || null });
      setShowRatingModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    } finally {
      setSubmittingRating(false);
    }
  };

  const cancelFeeCents = nowMs !== null
    ? computeCancellationFee(booking.preferredTime, booking.preferredDate, nowMs)
    : null;
  const refundCents =
    typeof booking.totalPriceCents === 'number' && cancelFeeCents !== null
      ? Math.max(0, booking.totalPriceCents - cancelFeeCents)
      : null;
  const timeUntilService = nowMs !== null
    ? getTimeUntilService(booking.preferredTime, booking.preferredDate, nowMs)
    : null;
  const cancelFeeStyle =
    cancelFeeCents === null
      ? 'border-slate-200 bg-slate-50 text-slate-700'
      : cancelFeeCents > 0
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  const statusConfig = STATUS_CONFIG[booking.status || 'pending'] || STATUS_CONFIG.pending;
  const isCancellable = !['completed', 'cancelled', 'in_progress', 'pending_verification'].includes(booking.status || '');
  const isReschedulable = !['completed', 'cancelled', 'in_progress', 'pending_verification'].includes(booking.status || '');

  const handleCancel = async () => {
    if (!supabase) return;

    setCancelling(true);
    setError(null);

    try {
      const res = await fetch('/api/requests/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booking.id, reason: cancelReason }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel booking');
      }

      router.refresh();
      setShowCancelModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  const handleReschedule = async () => {
    if (!supabase) return;

    setRescheduling(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('service_requests')
        .update({
          preferred_date: newDate || null,
          preferred_time: newTime || null,
        })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      router.refresh();
      setShowRescheduleModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reschedule');
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-slate-900">Booking Details</h1>
            <p className="text-sm text-slate-500">#{booking.id.slice(0, 8)}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 pb-24">
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Status Card */}
        <div className={`rounded-xl p-6 ${statusConfig.bgColor}`}>
          <div className="flex items-center gap-3">
            <span className={`text-3xl`}>
              {booking.status === 'completed' && '✅'}
              {booking.status === 'cancelled' && '❌'}
              {booking.status === 'in_progress' && '🔧'}
              {booking.status === 'assigned' && '👷'}
              {!['completed', 'cancelled', 'in_progress', 'assigned'].includes(booking.status || '') && '📋'}
            </span>
            <div>
              <h2 className={`text-xl font-bold ${statusConfig.color}`}>{statusConfig.label}</h2>
              <p className={`text-sm ${statusConfig.color} opacity-80`}>{statusConfig.description}</p>
            </div>
          </div>
        </div>

        {/* Service Details */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-900">Service Details</h3>

          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 text-2xl">
                {booking.serviceType === 'tv_mount' && '📺'}
                {booking.serviceType === 'assembly' && '🪑'}
                {booking.serviceType === 'electrical' && '💡'}
                {booking.serviceType === 'plumbing' && '🔧'}
                {booking.serviceType === 'punch' && '🔨'}
                {!['tv_mount', 'assembly', 'electrical', 'plumbing', 'punch'].includes(booking.serviceType || '') && '🛠️'}
              </div>
              <div>
                <p className="font-medium text-slate-900">
                  {booking.serviceType?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Service Request'}
                </p>
                <p className="text-sm text-slate-500">
                  Booked on {formatShortDate(booking.createdAt)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Scheduled Date</p>
                <p className="font-medium text-slate-900">{formatDate(booking.preferredDate)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Preferred Time</p>
                <p className="font-medium text-slate-900">{formatTime(booking.preferredTime) || 'Flexible'}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-500">Location</p>
              <p className="font-medium text-slate-900">
                {[booking.street, booking.city, booking.state, booking.postalCode].filter(Boolean).join(', ') || 'Not specified'}
              </p>
            </div>

            {booking.details && (
              <div>
                <p className="text-sm text-slate-500">Notes</p>
                <p className="whitespace-pre-wrap text-slate-700">{booking.details}</p>
              </div>
            )}
          </div>
        </div>

        {/* Pricing */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-900">Pricing</h3>

          <div className="mt-4 space-y-3">
            {booking.laborPriceCents !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Labor</span>
                <span className="font-medium text-slate-900">{formatPrice(booking.laborPriceCents)}</span>
              </div>
            )}
            {booking.materialsCostCents !== null && booking.materialsCostCents > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Materials</span>
                <span className="font-medium text-slate-900">{formatPrice(booking.materialsCostCents)}</span>
              </div>
            )}
            {booking.urgencyFeeCents !== null && booking.urgencyFeeCents > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Same-Day Service Fee</span>
                <span className="font-medium text-slate-900">{formatPrice(booking.urgencyFeeCents)}</span>
              </div>
            )}
            {booking.cancellationFeeCents !== null && booking.cancellationFeeCents > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-rose-600">Cancellation Fee</span>
                <span className="font-medium text-rose-600">{formatPrice(booking.cancellationFeeCents)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-3">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="text-xl font-bold text-slate-900">{formatPrice(booking.totalPriceCents)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Agent */}
        {agentProfile && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">Your Agent</h3>

            <div className="mt-4 flex items-center gap-4">
              {agentProfile.photo_url ? (
                <Image
                  src={agentProfile.photo_url}
                  alt="Agent"
                  width={64}
                  height={64}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-xl font-semibold text-emerald-700">
                  {agentProfile.first_name?.[0] || 'A'}
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-lg font-medium text-slate-900">
                    {[agentProfile.first_name, agentProfile.last_name].filter(Boolean).join(' ') || 'Your Agent'}
                  </p>
                  {agentProfile.tier && TIER_CONFIG[agentProfile.tier] && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${TIER_CONFIG[agentProfile.tier].bgColor} ${TIER_CONFIG[agentProfile.tier].color}`}>
                      <span>{TIER_CONFIG[agentProfile.tier].icon}</span>
                      {TIER_CONFIG[agentProfile.tier].label}
                    </span>
                  )}
                </div>
                {agentProfile.rating && (
                  <div className="flex items-center gap-1 text-sm text-slate-600">
                    <span className="text-amber-500">★</span>
                    <span>{agentProfile.rating.toFixed(1)}</span>
                    {agentProfile.total_jobs !== null && (
                      <span className="text-slate-400">• {agentProfile.total_jobs} jobs completed</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {agentProfile.phone && (
              <div className="mt-4">
                <a
                  href={`tel:${agentProfile.phone}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call {agentProfile.first_name || 'Agent'}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Message Your Agent */}
        {jobAssignment && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Message Your Agent</h3>
              <p className="text-sm text-slate-500 mt-1">Chat directly with your assigned agent</p>
            </div>
            <JobChat jobId={jobAssignment.id} className="h-80" />
          </div>
        )}

        {/* Job Progress */}
        {jobAssignment && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">Job Progress</h3>

            <div className="mt-4">
              <div className="relative">
                {/* Progress Line */}
                <div className="absolute left-3 top-3 h-[calc(100%-24px)] w-0.5 bg-slate-200" />

                <div className="space-y-6">
                  <div className="relative flex gap-4">
                    <div className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full ${
                      jobAssignment.status ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}>
                      <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Agent Assigned</p>
                      <p className="text-sm text-slate-500">Your agent has accepted the job</p>
                    </div>
                  </div>

                  <div className="relative flex gap-4">
                    <div className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full ${
                      jobAssignment.started_at ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}>
                      {jobAssignment.started_at ? (
                        <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Work Started</p>
                      {jobAssignment.started_at ? (
                        <p className="text-sm text-slate-500">
                          {formatDateTime(jobAssignment.started_at)}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400">Waiting for agent to check in</p>
                      )}
                    </div>
                  </div>

                  <div className="relative flex gap-4">
                    <div className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full ${
                      jobAssignment.completed_at ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}>
                      {jobAssignment.completed_at ? (
                        <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Work Completed</p>
                      {jobAssignment.completed_at ? (
                        <p className="text-sm text-slate-500">
                          {formatDateTime(jobAssignment.completed_at)}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400">In progress...</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rate Your Agent Section */}
        {(booking.status === 'complete' || booking.status === 'completed') && agentProfile && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">Rate Your Experience</h3>

            {hasRated && existingRating ? (
              <div className="mt-4">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`text-2xl ${star <= existingRating.rating ? 'text-amber-400' : 'text-slate-300'}`}
                    >
                      ★
                    </span>
                  ))}
                  <span className="ml-2 text-sm text-slate-600">Your rating</span>
                </div>
                {existingRating.review && (
                  <p className="mt-2 text-sm text-slate-600 italic">&ldquo;{existingRating.review}&rdquo;</p>
                )}
                <p className="mt-2 text-sm text-emerald-600">Thank you for your feedback!</p>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-slate-600">
                  How was your experience with {agentProfile.first_name || 'your agent'}?
                </p>
                <button
                  onClick={() => setShowRatingModal(true)}
                  className="mt-3 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  Leave a Review
                </button>
              </div>
            )}
          </div>
        )}

        {/* Proof of Work Photos */}
        {proofPhotos.length > 0 && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">Work Photos</h3>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {proofPhotos.map((photo) => (
                <div key={photo.id} className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="relative aspect-video">
                    <Image
                      src={photo.photo_url}
                      alt={photo.type === 'box' ? 'Before' : 'After'}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      photo.type === 'box' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {photo.type === 'box' ? 'Before' : 'After'}
                    </span>
                    {photo.notes && (
                      <p className="mt-2 text-sm text-slate-600">{photo.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cancellation Info */}
        {booking.status === 'cancelled' && (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-6">
            <h3 className="text-lg font-semibold text-rose-700">Booking Cancelled</h3>
            <p className="mt-2 text-sm text-rose-600">
              Cancelled on {formatDate(booking.cancelledAt)}
            </p>
            {booking.cancellationReason && (
              <p className="mt-2 text-slate-700">{booking.cancellationReason}</p>
            )}
            {typeof booking.cancellationFeeCents === 'number' && (
              <p className="mt-2 text-sm text-rose-600">
                Fee: {booking.cancellationFeeCents > 0 ? formatPrice(booking.cancellationFeeCents) : 'No fee'}
                {typeof booking.totalPriceCents === 'number' && (
                  <> · Refund: {formatPrice(Math.max(0, booking.totalPriceCents - booking.cancellationFeeCents))}</>
                )}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {(isCancellable || isReschedulable) && (
          <div className="mt-6 flex flex-wrap gap-3">
            {isReschedulable && (
              <button
                onClick={() => setShowRescheduleModal(true)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reschedule
              </button>
            )}
            {isCancellable && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="flex-1 rounded-lg border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-50"
              >
                Cancel Booking
              </button>
            )}
          </div>
        )}
      </main>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Cancel Booking</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to cancel this booking? This action cannot be undone.
            </p>
            <div className={`mt-3 rounded-lg border p-3 text-sm ${cancelFeeStyle}`}>
              {timeUntilService ? (
                <p>
                  You are <strong>{timeUntilService.description}</strong>.
                  {cancelFeeCents === null ? (
                    <> Checking your cancellation fee...</>
                  ) : cancelFeeCents > 0 ? (
                    <> Canceling now will incur a <strong>{formatPrice(cancelFeeCents)}</strong> fee on your refund.</>
                  ) : (
                    <> Canceling now is <strong>free</strong>.</>
                  )}
                </p>
              ) : (
                <p>
                  Cancellation fee:{' '}
                  {cancelFeeCents === null
                    ? 'Calculating...'
                    : cancelFeeCents > 0
                      ? formatPrice(cancelFeeCents)
                      : 'Free'}
                  .
                </p>
              )}
              {refundCents !== null && (
                <p className="mt-2">
                  Refund: <strong>{formatPrice(refundCents)}</strong> to your original payment method.
                </p>
              )}
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700">
                Reason for cancellation (optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Let us know why you're cancelling..."
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Rate Your Agent</h3>
            <p className="mt-2 text-sm text-slate-600">
              How would you rate your experience with {agentProfile?.first_name || 'your agent'}?
            </p>

            {/* Star Rating */}
            <div className="mt-6 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="text-4xl transition-transform hover:scale-110 focus:outline-none"
                >
                  <span className={star <= (hoverRating || rating) ? 'text-amber-400' : 'text-slate-300'}>
                    ★
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-sm text-slate-500">
              {rating === 1 && 'Poor'}
              {rating === 2 && 'Fair'}
              {rating === 3 && 'Good'}
              {rating === 4 && 'Very Good'}
              {rating === 5 && 'Excellent'}
              {rating === 0 && 'Select a rating'}
            </p>

            {/* Review Text */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700">
                Write a review (optional)
              </label>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="Share your experience..."
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowRatingModal(false);
                  setRating(0);
                  setReview('');
                }}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRating}
                disabled={submittingRating || rating === 0}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {submittingRating ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Reschedule Booking</h3>
            <p className="mt-2 text-sm text-slate-600">
              Choose a new date and time for your service.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">New Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  min={todayDate || undefined}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Preferred Time</label>
                <input
                  type="text"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  placeholder="e.g., 9 AM - 12 PM"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowRescheduleModal(false);
                  setNewDate(booking.preferredDate || '');
                  setNewTime(formatTime(booking.preferredTime) || '');
                }}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                disabled={rescheduling || !newDate}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {rescheduling ? 'Saving...' : 'Confirm New Date'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
