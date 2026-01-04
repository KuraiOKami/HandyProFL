'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import AdminServicesTable from '../AdminServicesTable';

type Service = {
  id: string;
  name: string | null;
  category: string | null;
  general_skill?: string | null;
  icon: string | null;
  base_minutes: number | null;
  price_cents: number | null;
  is_active: boolean;
  display_order: number | null;
};

type Suggestion = {
  id: string;
  suggested_name: string;
  suggested_category: string | null;
  description: string | null;
  why_needed: string | null;
  status: string;
  created_at: string;
  agent_name: string;
  agent_email: string | null;
};

export default function AdminServicesContent() {
  const [services, setServices] = useState<Service[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'catalog' | 'suggestions'>('catalog');

  // Suggestion review state
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  // Approval modal state
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveData, setApproveData] = useState<{
    id: string;
    name: string;
    category: string;
    general_skill: string;
    icon: string;
    base_minutes: number;
    price_cents: number;
  } | null>(null);

  useEffect(() => {
    loadServices();
    loadSuggestions();
  }, []);

  const loadServices = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Supabase not configured');
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('service_catalog')
      .select('id, name, category, general_skill, icon, base_minutes, price_cents, is_active, display_order')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setServices(data ?? []);
    }
    setLoading(false);
  };

  const loadSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const res = await fetch('/api/admin/suggestions');
      const data = await res.json();
      if (res.ok) {
        setSuggestions(data.suggestions || []);
      }
    } catch {
      // Ignore errors for suggestions
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');

  const handleReview = async (suggestionId: string, action: 'approve' | 'reject') => {
    const suggestion = suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return;

    if (action === 'approve') {
      // Open modal for approval with service details
      setApproveData({
        id: suggestion.suggested_name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
        name: suggestion.suggested_name,
        category: suggestion.suggested_category || 'general',
        general_skill: suggestion.suggested_category || 'general',
        icon: '🔧',
        base_minutes: 60,
        price_cents: 9900,
      });
      setApproveModalOpen(true);
      setReviewingId(suggestionId);
      return;
    }

    // For reject, just process directly
    setReviewingId(suggestionId);
    setReviewAction(action);
    setReviewError(null);
    setReviewSuccess(null);

    try {
      const res = await fetch('/api/admin/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestion_id: suggestionId,
          action,
          review_notes: reviewNotes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process suggestion');
      }

      setReviewSuccess(data.message);
      await loadSuggestions();
      setReviewNotes('');
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to process suggestion');
    } finally {
      setReviewingId(null);
      setReviewAction(null);
    }
  };

  const handleApproveSubmit = async () => {
    if (!approveData || !reviewingId) return;

    setReviewError(null);
    setReviewAction('approve');

    try {
      const res = await fetch('/api/admin/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestion_id: reviewingId,
          action: 'approve',
          review_notes: reviewNotes,
          service_data: approveData,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve suggestion');
      }

      setReviewSuccess(data.message);
      setApproveModalOpen(false);
      setApproveData(null);
      await Promise.all([loadSuggestions(), loadServices()]);
      setReviewNotes('');
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to approve suggestion');
    } finally {
      setReviewingId(null);
      setReviewAction(null);
    }
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <section className="grid gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
          <h2 className="text-xl font-semibold text-slate-900">Services</h2>
          <p className="text-sm text-slate-600">Manage catalog, pricing, and agent suggestions.</p>
        </div>
        <p className="text-sm text-slate-600">Loading services...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="grid gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
          <h2 className="text-xl font-semibold text-slate-900">Services</h2>
          <p className="text-sm text-slate-600">Manage catalog, pricing, and agent suggestions.</p>
        </div>
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h2 className="text-xl font-semibold text-slate-900">Services</h2>
        <p className="text-sm text-slate-600">Manage catalog, pricing, and agent suggestions.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === 'catalog'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Service Catalog ({services.length})
        </button>
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`relative px-4 py-2 text-sm font-medium transition ${
            activeTab === 'suggestions'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Agent Suggestions
          {pendingSuggestions.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {pendingSuggestions.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'catalog' && (
        <AdminServicesTable initial={services} />
      )}

      {activeTab === 'suggestions' && (
        <div className="grid gap-4">
          {reviewSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {reviewSuccess}
            </div>
          )}

          {reviewError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {reviewError}
            </div>
          )}

          {/* Pending Suggestions */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Pending Review</h3>
            <p className="text-sm text-slate-500">Services suggested by agents</p>

            {suggestionsLoading ? (
              <p className="mt-4 text-sm text-slate-600">Loading suggestions...</p>
            ) : pendingSuggestions.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No pending suggestions. Agents can suggest new services from their settings.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {pendingSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {suggestion.suggested_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Suggested by {suggestion.agent_name} · {formatRelative(suggestion.created_at)}
                        </p>
                        {suggestion.suggested_category && (
                          <p className="mt-1 text-xs text-slate-600">
                            Category: {suggestion.suggested_category}
                          </p>
                        )}
                        {suggestion.description && (
                          <p className="mt-2 text-sm text-slate-600">{suggestion.description}</p>
                        )}
                        {suggestion.why_needed && (
                          <p className="mt-2 text-sm text-slate-500 italic">
                            &quot;{suggestion.why_needed}&quot;
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview(suggestion.id, 'approve')}
                          disabled={reviewingId === suggestion.id}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
                        >
                          {reviewingId === suggestion.id && reviewAction === 'approve'
                            ? 'Approving...'
                            : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReview(suggestion.id, 'reject')}
                          disabled={reviewingId === suggestion.id}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:border-slate-200 disabled:text-slate-400"
                        >
                          {reviewingId === suggestion.id && reviewAction === 'reject'
                            ? 'Rejecting...'
                            : 'Reject'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Suggestions */}
          {suggestions.filter((s) => s.status !== 'pending').length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Review History</h3>
              <div className="mt-4 space-y-2">
                {suggestions
                  .filter((s) => s.status !== 'pending')
                  .map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {suggestion.suggested_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          by {suggestion.agent_name} · {formatRelative(suggestion.created_at)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          suggestion.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {suggestion.status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Approval Modal */}
      {approveModalOpen && approveData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Approve Service</h3>
            <p className="mt-1 text-sm text-slate-500">
              Configure the new service before adding to catalog.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Service ID</label>
                <input
                  type="text"
                  value={approveData.id}
                  onChange={(e) => setApproveData({ ...approveData, id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Display Name</label>
                <input
                  type="text"
                  value={approveData.name}
                  onChange={(e) => setApproveData({ ...approveData, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Category</label>
                  <input
                    type="text"
                    value={approveData.category}
                    onChange={(e) => setApproveData({ ...approveData, category: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">General Skill</label>
                  <input
                    type="text"
                    value={approveData.general_skill}
                    onChange={(e) => setApproveData({ ...approveData, general_skill: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Icon</label>
                  <input
                    type="text"
                    value={approveData.icon}
                    onChange={(e) => setApproveData({ ...approveData, icon: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Base Minutes</label>
                  <input
                    type="number"
                    value={approveData.base_minutes}
                    onChange={(e) => setApproveData({ ...approveData, base_minutes: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Price ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={(approveData.price_cents / 100).toFixed(2)}
                    onChange={(e) => setApproveData({ ...approveData, price_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Review Notes (optional)</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={2}
                  placeholder="Add a note for the agent..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {reviewError && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {reviewError}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setApproveModalOpen(false);
                  setApproveData(null);
                  setReviewingId(null);
                  setReviewError(null);
                }}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveSubmit}
                disabled={reviewAction === 'approve'}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-400"
              >
                {reviewAction === 'approve' ? 'Creating...' : 'Approve & Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
