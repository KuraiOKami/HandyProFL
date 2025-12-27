'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { formatTime } from '@/lib/formatting';
import Link from 'next/link';
import Image from 'next/image';
import type { ServiceId } from '@/hooks/useRequestWizard';

type Booking = {
  id: string;
  service_type: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  details: string | null;
  status: string | null;
  created_at: string | null;
  total_price_cents: number | null;
  assigned_agent_id: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancellation_fee_cents?: number | null;
  agent_profile: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    photo_url: string | null;
    rating: number | null;
  } | null;
  job_assignment: {
    id: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
  } | null;
};

type StatusFilter = 'all' | 'active' | 'completed' | 'cancelled';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bgColor: 'bg-amber-50' },
  confirmed: { label: 'Confirmed', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  scheduled: { label: 'Scheduled', color: 'text-indigo-700', bgColor: 'bg-indigo-50' },
  assigned: { label: 'Agent Assigned', color: 'text-purple-700', bgColor: 'bg-purple-50' },
  in_progress: { label: 'In Progress', color: 'text-cyan-700', bgColor: 'bg-cyan-50' },
  pending_verification: { label: 'Verifying', color: 'text-orange-700', bgColor: 'bg-orange-50' },
  completed: { label: 'Completed', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  cancelled: { label: 'Cancelled', color: 'text-rose-700', bgColor: 'bg-rose-50' },
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
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: DISPLAY_TIME_ZONE,
  }).format(date);
}

function formatPrice(cents: number | null): string {
  if (cents === null || cents === undefined) return 'Quote pending';
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

function getTimeUntilService(preferredTime: string | null, preferredDate: string | null): string | null {
  let serviceDate: Date | null = null;

  if (preferredTime) {
    const d = new Date(preferredTime);
    if (!Number.isNaN(d.getTime())) serviceDate = d;
  }

  if (!serviceDate && preferredDate) {
    const d = new Date(`${preferredDate}T12:00:00`);
    if (!Number.isNaN(d.getTime())) serviceDate = d;
  }

  if (!serviceDate) return null;

  const diffMs = serviceDate.getTime() - Date.now();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) {
    return 'past your appointment time';
  }

  if (diffHours < 1) {
    const minutes = Math.round(diffHours * 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} from your appointment`;
  }

  if (diffHours < 24) {
    const hours = Math.round(diffHours);
    return `${hours} hour${hours !== 1 ? 's' : ''} from your appointment`;
  }

  const days = Math.round(diffHours / 24);
  return `${days} day${days !== 1 ? 's' : ''} from your appointment`;
}

type Props = {
  onNewRequest?: (service?: ServiceId) => void;
};

export default function ClientBookingsContent({ onNewRequest }: Props) {
  const { session } = useSupabaseSession();
  const supabase = getSupabaseClient();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    const loadBookings = async () => {
      if (!session || !supabase) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch service requests with agent info
        const { data, error: fetchError } = await supabase
          .from('service_requests')
          .select(`
            id,
            service_type,
            preferred_date,
            preferred_time,
            details,
            status,
            created_at,
            total_price_cents,
            assigned_agent_id,
            cancelled_at,
            cancellation_reason,
            cancellation_fee_cents
          `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        // Fetch agent profiles for assigned requests
        const assignedAgentIds = (data || [])
          .filter((b) => b.assigned_agent_id)
          .map((b) => b.assigned_agent_id);

        const agentProfiles: Record<string, Booking['agent_profile']> = {};
        if (assignedAgentIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', assignedAgentIds);

          const { data: agentData } = await supabase
            .from('agent_profiles')
            .select('id, photo_url, rating')
            .in('id', assignedAgentIds);

          if (profiles) {
            profiles.forEach((p) => {
              const agentExtra = agentData?.find((a) => a.id === p.id);
              agentProfiles[p.id] = {
                id: p.id,
                first_name: p.first_name,
                last_name: p.last_name,
                photo_url: agentExtra?.photo_url || null,
                rating: agentExtra?.rating || null,
              };
            });
          }
        }

        // Fetch job assignments
        const requestIds = (data || []).map((b) => b.id);
        const assignments: Record<string, Booking['job_assignment']> = {};
        if (requestIds.length > 0) {
          const { data: jobData } = await supabase
            .from('job_assignments')
            .select('id, request_id, status, started_at, completed_at')
            .in('request_id', requestIds);

          if (jobData) {
            jobData.forEach((j) => {
              assignments[j.request_id] = {
                id: j.id,
                status: j.status,
                started_at: j.started_at,
                completed_at: j.completed_at,
              };
            });
          }
        }

        // Combine data
        const enrichedBookings = (data ?? []).map((b) => ({
          ...b,
          agent_profile: b.assigned_agent_id ? agentProfiles[b.assigned_agent_id] ?? null : null,
          job_assignment: assignments[b.id] ?? null,
        })) as Booking[];

        setBookings(enrichedBookings);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bookings');
      } finally {
        setLoading(false);
      }
    };

    loadBookings();
  }, [session, supabase]);

  const handleCancelBooking = async () => {
    if (!selectedBooking || !supabase || !session) return;

    setCancelling(true);
    try {
      const res = await fetch(`/api/requests/${selectedBooking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel booking');
      }

      const feeCents = typeof data.fee_cents === 'number'
        ? data.fee_cents
        : computeCancellationFee(selectedBooking.preferred_time, selectedBooking.preferred_date);
      const cancelledAt = data.cancelled_at || new Date().toISOString();

      setBookings((prev) =>
        prev.map((b) =>
          b.id === selectedBooking.id
            ? {
                ...b,
                status: 'cancelled',
                cancelled_at: cancelledAt,
                cancellation_reason: cancelReason || b.cancellation_reason || null,
                cancellation_fee_cents: feeCents,
              }
            : b
        )
      );
      setSelectedBooking(null);
      setCancelReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'all') return true;
    if (filter === 'active') {
      return !['completed', 'cancelled'].includes(b.status || '');
    }
    if (filter === 'completed') return b.status === 'completed';
    if (filter === 'cancelled') return b.status === 'cancelled';
    return true;
  });

  const activeCount = bookings.filter((b) => !['completed', 'cancelled'].includes(b.status || '')).length;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;
  const selectedFeeCents = selectedBooking
    ? computeCancellationFee(selectedBooking.preferred_time, selectedBooking.preferred_date)
    : 0;
  const selectedRefundCents =
    selectedBooking && typeof selectedBooking.total_price_cents === 'number'
      ? Math.max(0, selectedBooking.total_price_cents - selectedFeeCents)
      : null;
  const selectedTimeUntil = selectedBooking
    ? getTimeUntilService(selectedBooking.preferred_time, selectedBooking.preferred_date)
    : null;

  if (!session) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Please sign in to view your bookings.</p>
        <Link
          href="/auth?redirect=/dashboard"
          className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Active Bookings</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Completed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{completedCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Total Bookings</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{bookings.length}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {(['all', 'active', 'completed', 'cancelled'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-700"></div>
            <p className="text-sm text-slate-600">Loading your bookings...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredBookings.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="mb-4 text-4xl">📋</div>
          <h3 className="text-lg font-semibold text-slate-900">No bookings found</h3>
          <p className="mt-1 text-sm text-slate-600">
            {filter === 'all'
              ? "You haven't made any service requests yet."
              : `No ${filter} bookings to show.`}
          </p>
          <button
            onClick={() => onNewRequest?.()}
            className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Book a Service
          </button>
        </div>
      )}

      {/* Bookings List */}
      {!loading && filteredBookings.length > 0 && (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onCancel={() => setSelectedBooking(booking)}
            />
          ))}
        </div>
      )}

      {/* Cancel Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Cancel Booking</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to cancel this booking? This action cannot be undone.
            </p>
            <div className={`mt-3 rounded-lg border p-3 text-sm ${selectedFeeCents > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
              {selectedTimeUntil ? (
                <p>
                  You are <strong>{selectedTimeUntil}</strong>.
                  {selectedFeeCents > 0 ? (
                    <> Canceling now will incur a <strong>{formatPrice(selectedFeeCents)}</strong> fee on your refund.</>
                  ) : (
                    <> Canceling now is <strong>free</strong>.</>
                  )}
                </p>
              ) : (
                <p>
                  Cancellation fee: {selectedFeeCents > 0 ? formatPrice(selectedFeeCents) : 'Free'}.
                </p>
              )}
              {selectedRefundCents !== null && (
                <p className="mt-2">
                  Refund: <strong>{formatPrice(selectedRefundCents)}</strong> to your original payment method.
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
                  setSelectedBooking(null);
                  setCancelReason('');
                }}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={cancelling}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type BookingCardProps = {
  booking: Booking;
  onCancel: () => void;
};

function BookingCard({ booking, onCancel }: BookingCardProps) {
  const statusConfig = STATUS_CONFIG[booking.status || 'pending'] || STATUS_CONFIG.pending;
  const isCancellable = !['completed', 'cancelled', 'in_progress'].includes(booking.status || '');
  const isActive = !['completed', 'cancelled'].includes(booking.status || '');

  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
      isActive ? 'border-indigo-200' : 'border-slate-200'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-xl">
            {booking.service_type === 'tv_mount' && '📺'}
            {booking.service_type === 'assembly' && '🪑'}
            {booking.service_type === 'electrical' && '💡'}
            {booking.service_type === 'plumbing' && '🔧'}
            {booking.service_type === 'punch' && '🔨'}
            {!['tv_mount', 'assembly', 'electrical', 'plumbing', 'punch'].includes(booking.service_type || '') && '🛠️'}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">
              {booking.service_type?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Service Request'}
            </h3>
            <p className="text-sm text-slate-500">
              Booked {booking.created_at ? new Date(booking.created_at).toLocaleDateString() : 'recently'}
            </p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusConfig.bgColor} ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
      </div>

      {/* Details */}
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-slate-500">Scheduled Date</p>
          <p className="font-medium text-slate-900">{formatDate(booking.preferred_date)}</p>
          {booking.preferred_time && (
            <p className="text-slate-600">{formatTime(booking.preferred_time)}</p>
          )}
        </div>
        <div>
          <p className="text-slate-500">Price</p>
          <p className="font-medium text-slate-900">{formatPrice(booking.total_price_cents)}</p>
        </div>
      </div>


      {/* Notes */}
      {booking.details && (
        <div className="mt-3 text-sm">
          <p className="text-slate-500">Notes</p>
          <p className="text-slate-700 line-clamp-2">{booking.details}</p>
        </div>
      )}

      {/* Assigned Agent */}
      {booking.agent_profile && (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
          {booking.agent_profile.photo_url ? (
            <Image
              src={booking.agent_profile.photo_url}
              alt="Agent"
              width={40}
              height={40}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
              {booking.agent_profile.first_name?.[0] || 'A'}
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">
              {[booking.agent_profile.first_name, booking.agent_profile.last_name].filter(Boolean).join(' ') || 'Your Agent'}
            </p>
            {booking.agent_profile.rating && (
              <p className="text-xs text-slate-500">
                Rating: {booking.agent_profile.rating.toFixed(1)} / 5
              </p>
            )}
          </div>
          <Link
            href={`/dashboard?tab=messages&booking=${booking.id}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Message
          </Link>
        </div>
      )}

      {/* Cancellation Info */}
      {booking.status === 'cancelled' && booking.cancelled_at && (
        <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm">
          <p className="font-medium text-rose-700">Cancelled on {formatDate(booking.cancelled_at)}</p>
          {booking.cancellation_reason && (
            <p className="mt-1 text-rose-600">{booking.cancellation_reason}</p>
          )}
          {typeof booking.cancellation_fee_cents === 'number' && (
            <p className="mt-1 text-rose-600">
              Fee: {booking.cancellation_fee_cents > 0 ? formatPrice(booking.cancellation_fee_cents) : 'No fee'}
              {typeof booking.total_price_cents === 'number' && (
                <> · Refund: {formatPrice(Math.max(0, booking.total_price_cents - booking.cancellation_fee_cents))}</>
              )}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/booking/${booking.id}`}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          View Details
        </Link>
        {isCancellable && (
          <button
            onClick={onCancel}
            className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
