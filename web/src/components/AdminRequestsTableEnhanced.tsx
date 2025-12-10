'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

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
  client_name?: string;
  client_email?: string;
  client_phone?: string;
};

type ClientMap = Record<string, { name: string; email: string; phone: string }>;

const statuses = ['pending', 'confirmed', 'complete', 'cancelled'];

const statusConfig: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  complete: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  cancelled: { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', dot: 'bg-slate-400' },
};

const ITEMS_PER_PAGE = 10;

export default function AdminRequestsTableEnhanced({ initial }: { initial: Request[] }) {
  const [requests, setRequests] = useState<Request[]>(initial);
  const [clients, setClients] = useState<ClientMap>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Drag and drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  // Load client names
  useEffect(() => {
    const loadClients = async () => {
      try {
        const res = await fetch('/api/admin/clients');
        if (res.ok) {
          const data = await res.json();
          const clientMap: ClientMap = {};
          (data.clients || []).forEach((c: { id: string; first_name?: string; last_name?: string; email?: string; phone?: string }) => {
            const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown';
            clientMap[c.id] = { name, email: c.email || '', phone: c.phone || '' };
          });
          setClients(clientMap);
        }
      } catch {
        // Silent fail
      }
    };
    loadClients();
  }, []);

  // Filter and search logic
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const searchLower = searchQuery.toLowerCase();
      const clientInfo = clients[req.user_id || ''];
      const clientName = clientInfo?.name || '';

      const matchesSearch =
        !searchQuery ||
        req.service_type?.toLowerCase().includes(searchLower) ||
        req.details?.toLowerCase().includes(searchLower) ||
        clientName.toLowerCase().includes(searchLower) ||
        clientInfo?.email?.toLowerCase().includes(searchLower);

      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [requests, searchQuery, statusFilter, clients]);

  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRequests.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRequests, currentPage]);

  // Group by status for Kanban
  const groupedByStatus = useMemo(() => {
    const groups: Record<string, Request[]> = {
      pending: [],
      confirmed: [],
      complete: [],
      cancelled: [],
    };
    filteredRequests.forEach((req) => {
      const status = req.status || 'pending';
      if (groups[status]) {
        groups[status].push(req);
      }
    });
    return groups;
  }, [filteredRequests]);

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

  const getStatusStyle = (status: string | null) => {
    return statusConfig[status || 'pending'] || statusConfig.pending;
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);

    // Create a custom drag image
    const element = e.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    const dragImage = element.cloneNode(true) as HTMLElement;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-9999px';
    dragImage.style.left = '-9999px';
    dragImage.style.width = `${rect.width}px`;
    dragImage.style.opacity = '0.9';
    dragImage.style.transform = 'rotate(3deg)';
    dragImage.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, rect.width / 2, 20);

    // Clean up the drag image after a short delay
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverStatus(null);
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the column entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget?.closest(`[data-status]`)) {
      setDragOverStatus(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');

    const request = requests.find((r) => r.id === id);
    if (request && request.status !== newStatus) {
      // Optimistic update - immediately move the card
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));

      // Then persist to database
      setSavingId(id);
      const res = await fetch('/api/admin/requests/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updates: { status: newStatus } }),
      });

      if (!res.ok) {
        // Revert on failure
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: request.status } : r)));
        setError('Failed to update status');
      }
      setSavingId(null);
    }

    setDraggedId(null);
    setDragOverStatus(null);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatRelativeDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    return formatDate(dateStr);
  };

  // Stats
  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    confirmed: requests.filter((r) => r.status === 'confirmed').length,
    complete: requests.filter((r) => r.status === 'complete').length,
  }), [requests]);

  const RequestCard = ({ req, compact = false, draggable = false }: { req: Request; compact?: boolean; draggable?: boolean }) => {
    const style = getStatusStyle(req.status);
    const clientInfo = clients[req.user_id || ''];
    const isDragging = draggedId === req.id;

    return (
      <div
        id={`request-card-${req.id}`}
        draggable={draggable}
        onDragStart={draggable ? (e) => handleDragStart(e, req.id) : undefined}
        onDragEnd={draggable ? handleDragEnd : undefined}
        className={`rounded-xl border bg-white p-4 transition hover:shadow-md ${style.border} ${
          draggable ? 'cursor-grab active:cursor-grabbing' : ''
        } ${isDragging ? 'opacity-50 ring-2 ring-indigo-400' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-2 w-2 rounded-full ${style.dot}`}></span>
              <h4 className="font-semibold text-slate-900 truncate">{req.service_type || 'Service Request'}</h4>
            </div>
            <p className="mt-1 text-sm text-slate-600">{clientInfo?.name || 'Unknown Client'}</p>
            {!compact && clientInfo?.email && (
              <p className="text-xs text-slate-400">{clientInfo.email}</p>
            )}
          </div>
          <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${style.bg} ${style.text}`}>
            {req.status}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
          <span>{formatRelativeDate(req.preferred_date)}</span>
          {req.preferred_time && <span>{req.preferred_time}</span>}
          {req.estimated_minutes && <span>{req.estimated_minutes} min</span>}
        </div>

        {!compact && req.details && (
          <p className="mt-2 text-sm text-slate-600 line-clamp-2">{req.details}</p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {req.status === 'pending' && (
              <button
                onClick={() => updateRequest(req.id, { status: 'confirmed' })}
                disabled={savingId === req.id}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Confirm
              </button>
            )}
            {req.status === 'confirmed' && (
              <button
                onClick={() => updateRequest(req.id, { status: 'complete' })}
                disabled={savingId === req.id}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Complete
              </button>
            )}
            {(req.status === 'pending' || req.status === 'confirmed') && (
              <button
                onClick={() => updateRequest(req.id, { status: 'cancelled' })}
                disabled={savingId === req.id}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
          <Link
            href={`/admin/requests/${req.id}`}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            View details
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total</p>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <button
          onClick={() => { setStatusFilter('pending'); setCurrentPage(1); }}
          className={`rounded-xl border p-4 text-left transition hover:shadow-md ${statusFilter === 'pending' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
        </button>
        <button
          onClick={() => { setStatusFilter('confirmed'); setCurrentPage(1); }}
          className={`rounded-xl border p-4 text-left transition hover:shadow-md ${statusFilter === 'confirmed' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Confirmed</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.confirmed}</p>
        </button>
        <button
          onClick={() => { setStatusFilter('complete'); setCurrentPage(1); }}
          className={`rounded-xl border p-4 text-left transition hover:shadow-md ${statusFilter === 'complete' ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Completed</p>
          <p className="text-2xl font-bold text-blue-600">{stats.complete}</p>
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <input
              type="search"
              placeholder="Search requests, clients..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          {(searchQuery || statusFilter !== 'all') && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); setCurrentPage(1); }}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="flex items-center rounded-lg border border-slate-200 p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              viewMode === 'kanban' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Kanban
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <>
          <div className="grid gap-3">
            {paginatedRequests.map((req) => (
              <RequestCard key={req.id} req={req} />
            ))}
            {paginatedRequests.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                <p className="text-sm text-slate-500">No requests match your filters</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-sm text-slate-500">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredRequests.length)} of {filteredRequests.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(['pending', 'confirmed', 'complete', 'cancelled'] as const).map((status) => {
            const style = statusConfig[status];
            const statusRequests = groupedByStatus[status] || [];
            const isDropTarget = dragOverStatus === status;

            return (
              <div
                key={status}
                data-status={status}
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, status)}
                className={`rounded-xl border-2 p-3 transition-all ${
                  isDropTarget
                    ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`}></span>
                    <h3 className="font-semibold capitalize text-slate-900">{status}</h3>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                    {statusRequests.length}
                  </span>
                </div>
                <div className={`space-y-2 max-h-[600px] min-h-[100px] overflow-y-auto rounded-lg transition-colors ${
                  isDropTarget ? 'bg-indigo-100/50' : ''
                }`}>
                  {statusRequests.map((req) => (
                    <RequestCard key={req.id} req={req} compact draggable />
                  ))}
                  {statusRequests.length === 0 && (
                    <div className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                      isDropTarget ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'
                    }`}>
                      <p className="text-xs text-slate-400">
                        {isDropTarget ? 'Drop here' : 'No requests'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
