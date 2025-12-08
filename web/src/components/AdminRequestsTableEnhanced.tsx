'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type Request = {
  id: string;
  service_type: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  details: string | null;
  status: string | null;
  estimated_minutes?: number | null;
  user_id: string | null;
  created_at?: string | null;
};

const statuses = ['pending', 'confirmed', 'complete', 'cancelled'];
const ITEMS_PER_PAGE = 10;

export default function AdminRequestsTableEnhanced({ initial }: { initial: Request[] }) {
  const [requests, setRequests] = useState<Request[]>(initial);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Bulk actions state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Filter and search logic
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Search filter (service type, details, user ID)
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        req.service_type?.toLowerCase().includes(searchLower) ||
        req.details?.toLowerCase().includes(searchLower) ||
        req.user_id?.toLowerCase().includes(searchLower);

      // Status filter
      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;

      // Date filter
      const matchesDate = !dateFilter || req.preferred_date === dateFilter;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [requests, searchQuery, statusFilter, dateFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredRequests.slice(start, end);
  }, [filteredRequests, currentPage]);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const updateRequest = async (id: string, updates: Partial<Request>) => {
    setSavingId(id);
    setError(null);
    const res = await fetch('/api/admin/requests/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Failed to update request.');
      setSavingId(null);
      return;
    }
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    setSavingId(null);
  };

  const handleBulkAction = async (action: 'confirm' | 'cancel' | 'delete') => {
    if (selectedIds.size === 0) return;

    setBulkActionLoading(true);
    setError(null);

    const updates = action === 'confirm' ? { status: 'confirmed' } : action === 'cancel' ? { status: 'cancelled' } : null;

    try {
      for (const id of Array.from(selectedIds)) {
        if (action === 'delete') {
          // Delete logic would go here
          setRequests((prev) => prev.filter((r) => r.id !== id));
        } else if (updates) {
          await updateRequest(id, updates);
        }
      }
      setSelectedIds(new Set());
    } catch {
      setError('Bulk action failed for some requests.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedRequests.map((r) => r.id)));
    }
  };

  return (
    <div className="grid gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
          <h2 className="text-xl font-semibold text-slate-900">All requests</h2>
          <p className="text-sm text-slate-600">
            {filteredRequests.length} of {requests.length} requests
          </p>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">{selectedIds.size} selected</span>
            <button
              onClick={() => handleBulkAction('confirm')}
              disabled={bulkActionLoading}
              className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Confirm all
            </button>
            <button
              onClick={() => handleBulkAction('cancel')}
              disabled={bulkActionLoading}
              className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel all
            </button>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleFilterChange(setSearchQuery, e.target.value)}
              placeholder="Service type, details, user ID..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {/* Date Filter */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => handleFilterChange(setDateFilter, e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Clear Filters */}
          <div className="flex items-end md:col-span-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setDateFilter('');
                setCurrentPage(1);
              }}
              className="text-sm font-semibold text-indigo-700 hover:text-indigo-800 hover:underline"
            >
              Clear all filters
            </button>
          </div>
        </div>
      </div>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {/* Select All Checkbox */}
      {paginatedRequests.length > 0 && (
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <input
            type="checkbox"
            checked={selectedIds.size === paginatedRequests.length && paginatedRequests.length > 0}
            onChange={toggleSelectAll}
            className="h-4 w-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-600"
          />
          <span className="text-sm font-semibold text-slate-700">Select all on page</span>
        </div>
      )}

      {/* Requests List */}
      <div className="grid gap-2">
        {paginatedRequests.map((req) => (
          <div
            key={req.id}
            className={`rounded-lg border p-4 ${
              selectedIds.has(req.id) ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedIds.has(req.id)}
                onChange={() => toggleSelection(req.id)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-600"
              />
              <div className="flex-1 grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                      {req.service_type || 'Service'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                      {req.status || 'pending'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-slate-500">
                      {req.preferred_date || 'Date'} @ {req.preferred_time || 'Time'} | Est: {req.estimated_minutes ?? '—'} min
                    </p>
                    <Link
                      href={`/admin/requests/${req.id}`}
                      className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                </div>
                <p className="text-xs text-slate-500">User: {req.user_id || 'Unknown'}</p>
                <p className="text-sm text-slate-800">{req.details || 'No details.'}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={req.status ?? 'pending'}
                    onChange={(e) => updateRequest(req.id, { status: e.target.value })}
                    disabled={savingId === req.id}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={req.preferred_date ?? ''}
                    onChange={(e) => updateRequest(req.id, { preferred_date: e.target.value })}
                    disabled={savingId === req.id}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <input
                    type="text"
                    value={req.preferred_time ?? ''}
                    onChange={(e) => updateRequest(req.id, { preferred_time: e.target.value })}
                    disabled={savingId === req.id}
                    placeholder="e.g., 9:00 AM"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    onClick={() => updateRequest(req.id, { status: 'cancelled' })}
                    disabled={savingId === req.id}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {!paginatedRequests.length && !searchQuery && !statusFilter && !dateFilter && (
          <p className="text-sm text-slate-600">No requests found.</p>
        )}
        {!paginatedRequests.length && (searchQuery || statusFilter !== 'all' || dateFilter) && (
          <p className="text-sm text-slate-600">
            No requests match your filters. Try clearing filters or adjusting your search.
          </p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-600">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-9 w-9 rounded-lg text-sm font-semibold ${
                      currentPage === pageNum
                        ? 'bg-indigo-700 text-white'
                        : 'border border-slate-300 text-slate-800 hover:border-indigo-600 hover:text-indigo-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
