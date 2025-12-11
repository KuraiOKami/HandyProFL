'use client';

import { useEffect, useState } from 'react';

type AvailableGig = {
  id: string;
  service_type: string;
  preferred_date: string;
  preferred_time: string;
  estimated_minutes: number;
  details: string | null;
  city: string;
  state: string;
  agent_payout_cents: number;
  has_location?: boolean;
};

export default function AgentGigsContent() {
  const [gigs, setGigs] = useState<AvailableGig[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all');
  const [selectedGig, setSelectedGig] = useState<AvailableGig | null>(null);

  useEffect(() => {
    loadGigs();
  }, []);

  const loadGigs = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agent/gigs');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load gigs');
      }

      setGigs(data.gigs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gigs');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptGig = async (requestId: string) => {
    setAccepting(requestId);
    setError(null);

    try {
      const res = await fetch(`/api/agent/gigs/${requestId}/accept`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept gig');
      }

      // Remove the accepted gig from the list and close modal
      setGigs((prev) => prev.filter((g) => g.id !== requestId));
      setSelectedGig(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept gig');
    } finally {
      setAccepting(null);
    }
  };

  const handleViewGig = (gig: AvailableGig) => {
    setSelectedGig(gig);
  };

  const closeModal = () => {
    setSelectedGig(null);
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

  const formatTime = (timeStr: string) => {
    // Handle ISO datetime strings like "2025-12-11T15:00:00+00:00"
    if (timeStr.includes('T')) {
      const date = new Date(timeStr);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
    // Handle simple time strings like "9:00 AM" or "14:00"
    return timeStr;
  };

  const getFilteredGigs = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    switch (filter) {
      case 'today':
        return gigs.filter((g) => g.preferred_date === today);
      case 'week':
        return gigs.filter((g) => g.preferred_date >= today && g.preferred_date <= weekFromNow);
      default:
        return gigs;
    }
  };

  const filteredGigs = getFilteredGigs();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700"></div>
          <p className="text-sm text-slate-600">Finding available gigs...</p>
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
            {filteredGigs.length} {filteredGigs.length === 1 ? 'gig' : 'gigs'} available
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Show:</span>
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {(['all', 'today', 'week'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  filter === f
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f === 'all' ? 'All' : f === 'today' ? 'Today' : 'This Week'}
              </button>
            ))}
          </div>
          <button
            onClick={loadGigs}
            className="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Gigs Grid */}
      {filteredGigs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
          <div className="mb-3 text-4xl">🔍</div>
          <p className="text-lg font-medium text-slate-900">No gigs available</p>
          <p className="mt-1 text-sm text-slate-500">Check back soon for new jobs in your area</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredGigs.map((gig) => (
            <div
              key={gig.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-300 hover:shadow-md cursor-pointer"
              onClick={() => handleViewGig(gig)}
            >
              {/* Card Header */}
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{formatServiceType(gig.service_type)}</h3>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {gig.city}, {gig.state}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(gig.agent_payout_cents)}</p>
                    <p className="text-xs text-slate-500">your earnings</p>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="flex-1 px-5 py-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span>📅</span>
                    <span>
                      {new Date(gig.preferred_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <span>🕐</span>
                    <span>{formatTime(gig.preferred_time)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <span>⏱️</span>
                    <span>Est. {formatDuration(gig.estimated_minutes)}</span>
                  </div>
                </div>

                {gig.details && (
                  <p className="mt-3 text-sm text-slate-600 line-clamp-2">{gig.details}</p>
                )}
              </div>

              {/* Card Footer */}
              <div className="border-t border-slate-100 px-5 py-4">
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewGig(gig);
                    }}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    View Details
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAcceptGig(gig.id);
                    }}
                    disabled={accepting === gig.id}
                    className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-emerald-400"
                  >
                    {accepting === gig.id ? 'Accepting...' : 'Accept'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gig Detail Modal */}
      {selectedGig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeModal}>
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {formatServiceType(selectedGig.service_type)}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Gig Details</p>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-5">
              {/* Earnings */}
              <div className="rounded-lg bg-emerald-50 p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-emerald-700">Your Earnings</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(selectedGig.agent_payout_cents)}</p>
                </div>
              </div>

              {/* Schedule */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Schedule</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-lg">📅</span>
                    <div>
                      <p className="font-medium text-slate-900">
                        {new Date(selectedGig.preferred_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-lg">🕐</span>
                    <p className="font-medium text-slate-900">{formatTime(selectedGig.preferred_time)}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-lg">⏱️</span>
                    <p className="text-slate-600">Estimated {formatDuration(selectedGig.estimated_minutes)}</p>
                  </div>
                </div>
              </div>

              {/* Location - General area only before accepting */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Location</h3>
                <div className="flex items-start gap-3 text-sm">
                  <span className="text-lg">📍</span>
                  <div>
                    <p className="font-medium text-slate-900">
                      {selectedGig.city}, {selectedGig.state}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Full address available after accepting
                    </p>
                  </div>
                </div>
              </div>

              {/* Job Details */}
              {selectedGig.details && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">Job Details</h3>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedGig.details}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 px-6 py-4">
              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  onClick={() => handleAcceptGig(selectedGig.id)}
                  disabled={accepting === selectedGig.id}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-emerald-400"
                >
                  {accepting === selectedGig.id ? 'Accepting...' : 'Accept This Gig'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
