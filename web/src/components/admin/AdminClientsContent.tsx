'use client';

import { useEffect, useMemo, useState } from 'react';

type ClientProfile = {
  id: string;
  first_name: string | null;
  middle_initial: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  role: string | null;
};

type ClientRow = ClientProfile & {
  totalRequests: number;
  openRequests: number;
  addressCount: number;
  lastInteractionAt: string | null;
  status: 'Active' | 'Prospect' | 'Inactive';
};

type Message = {
  id: string;
  body: string;
  channel: 'note' | 'sms' | 'email';
  direction: 'outbound' | 'inbound';
  timestamp: string;
  sender: string;
};

const statusStyles: Record<ClientRow['status'], string> = {
  Active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  Prospect: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
  Inactive: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
};

const formatRelativeTime = (dateString: string | null) => {
  if (!dateString) return 'No activity';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'No activity';
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} mo ago`;
  const diffYears = Math.round(diffMonths / 12);
  return `${diffYears} yr${diffYears > 1 ? 's' : ''} ago`;
};

const getFullName = (c: ClientProfile) => [c.first_name, c.middle_initial, c.last_name].filter(Boolean).join(' ') || 'Unknown';

const deriveStatus = (openRequests: number, lastInteractionAt: string | null): ClientRow['status'] => {
  if (openRequests > 0) return 'Active';
  if (lastInteractionAt) {
    const date = new Date(lastInteractionAt);
    const diffDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 45) return 'Active';
    if (diffDays <= 120) return 'Prospect';
  }
  return 'Inactive';
};

const seedMessages = (name: string) => [
  {
    id: `seed-${Math.random().toString(36).slice(2)}`,
    body: `Start a note or message for ${name}. Keep request details, approvals, or reminders here.`,
    channel: 'note' as const,
    direction: 'inbound' as const,
    timestamp: new Date().toISOString(),
    sender: 'System',
  },
];

export default function AdminClientsContent() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Prospect' | 'Inactive'>('all');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [messagesByClient, setMessagesByClient] = useState<Record<string, Message[]>>({});
  const [composerChannel, setComposerChannel] = useState<Message['channel']>('note');
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const loadClients = async () => {
      try {
        const res = await fetch('/api/admin/clients');

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || 'Failed to load clients');
          setLoading(false);
          return;
        }

        const { clients, requestCounts, addressCounts, openRequestCounts, lastInteractions } = await res.json();
        const enriched: ClientRow[] = (clients ?? []).map((c: ClientProfile) => {
          const totalRequests = (requestCounts && requestCounts[c.id]) || 0;
          const addressCount = (addressCounts && addressCounts[c.id]) || 0;
          const openRequests = (openRequestCounts && openRequestCounts[c.id]) || 0;
          const lastInteractionAt = (lastInteractions && lastInteractions[c.id]) || null;
          const status = deriveStatus(openRequests, lastInteractionAt);

          return {
            ...c,
            totalRequests,
            addressCount,
            openRequests,
            lastInteractionAt,
            status,
          };
        });

        setClients(enriched);
        setLoading(false);
      } catch {
        setError('Failed to load clients');
        setLoading(false);
      }
    };

    loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clients
      .filter((c) => {
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        if (!term) return true;
        const location = [c.city, c.state, c.postal_code].filter(Boolean).join(' ').toLowerCase();
        return (
          getFullName(c).toLowerCase().includes(term) ||
          (c.email || '').toLowerCase().includes(term) ||
          (c.phone || '').toLowerCase().includes(term) ||
          location.includes(term)
        );
      })
      .sort((a, b) => {
        const aDate = a.lastInteractionAt ? new Date(a.lastInteractionAt).getTime() : 0;
        const bDate = b.lastInteractionAt ? new Date(b.lastInteractionAt).getTime() : 0;
        return bDate - aDate;
      });
  }, [clients, search, statusFilter]);

  const selectedClient = selectedClientId ? clients.find((c) => c.id === selectedClientId) ?? null : null;

  useEffect(() => {
    if (selectedClient && !messagesByClient[selectedClient.id]) {
      setMessagesByClient((prev) => ({
        ...prev,
        [selectedClient.id]: seedMessages(getFullName(selectedClient)),
      }));
      setDraft('');
      setComposerChannel('note');
    }
  }, [selectedClient, messagesByClient]);

  const handleSendMessage = () => {
    if (!selectedClient || !draft.trim()) return;
    const newMessage: Message = {
      id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      body: draft.trim(),
      channel: composerChannel,
      direction: 'outbound',
      timestamp: new Date().toISOString(),
      sender: 'Admin',
    };

    setMessagesByClient((prev) => {
      const existing = prev[selectedClient.id] ?? [];
      return {
        ...prev,
        [selectedClient.id]: [...existing, newMessage],
      };
    });
    setDraft('');
  };

  const pillButton = (label: string, active: boolean, onClick: () => void, tone: 'primary' | 'neutral') => (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active
          ? tone === 'primary'
            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100'
            : 'bg-slate-800 text-white shadow-sm shadow-slate-200'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );

  const renderDrawer = () => {
    if (!selectedClient) return null;
    const messages = messagesByClient[selectedClient.id] ?? [];

    return (
      <div className="fixed inset-0 z-40 flex items-start justify-end bg-slate-900/30 backdrop-blur-sm">
        <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl ring-1 ring-slate-200">
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Client</p>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-slate-900">{getFullName(selectedClient)}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[selectedClient.status]}`}>
                  {selectedClient.status}
                </span>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {selectedClient.role || 'client'}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {selectedClient.email || 'No email'} • {selectedClient.phone || 'No phone'}
              </p>
            </div>
            <button
              onClick={() => setSelectedClientId(null)}
              className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>

          <div className="grid gap-5 p-5">
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap gap-2 text-sm text-slate-700">
                <span className="rounded-md bg-white px-3 py-2 ring-1 ring-slate-200">
                  Last interaction: <strong>{formatRelativeTime(selectedClient.lastInteractionAt)}</strong>
                </span>
                <span className="rounded-md bg-white px-3 py-2 ring-1 ring-slate-200">
                  Open requests: <strong>{selectedClient.openRequests}</strong>
                </span>
                <span className="rounded-md bg-white px-3 py-2 ring-1 ring-slate-200">
                  Total requests: <strong>{selectedClient.totalRequests}</strong>
                </span>
                <span className="rounded-md bg-white px-3 py-2 ring-1 ring-slate-200">
                  Addresses: <strong>{selectedClient.addressCount}</strong>
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {[selectedClient.street, selectedClient.city, selectedClient.state, selectedClient.postal_code].filter(Boolean).join(', ') ||
                  'No address on file'}
              </p>
            </div>

            <div className="grid gap-3 rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Activity</p>
                  <h4 className="text-lg font-semibold text-slate-900">Recent</h4>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {selectedClient.status === 'Active' ? 'Engaged' : 'Needs touchpoint'}
                </span>
              </div>
              <div className="grid gap-2 text-sm text-slate-700">
                <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                  {selectedClient.lastInteractionAt
                    ? `Last request ${formatRelativeTime(selectedClient.lastInteractionAt)}`
                    : 'No requests yet'}
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                  {selectedClient.openRequests > 0
                    ? `${selectedClient.openRequests} open request${selectedClient.openRequests > 1 ? 's' : ''} awaiting action`
                    : 'No open requests'}
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                  Keep notes, quotes, and approvals in the chat below. Use SMS/email when ready to contact the client.
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Messages</p>
                  <h4 className="text-lg font-semibold text-slate-900">Chat & notes</h4>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {['note', 'sms', 'email'].map((channel) => (
                    <button
                      key={channel}
                      onClick={() => setComposerChannel(channel as Message['channel'])}
                      className={`rounded-full px-3 py-1 capitalize transition ${
                        composerChannel === channel
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {channel}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                {messages.map((message) => {
                  const outbound = message.direction === 'outbound';
                  return (
                    <div
                      key={message.id}
                      className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                          outbound
                            ? 'bg-indigo-600 text-white shadow-indigo-100'
                            : 'bg-white text-slate-800 ring-1 ring-slate-200'
                        }`}
                      >
                        <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{message.channel}</span>
                          <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                          <span>{message.sender}</span>
                        </div>
                        <p className="whitespace-pre-line">{message.body}</p>
                      </div>
                    </div>
                  );
                })}
                {!messages.length && (
                  <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
                    No messages yet. Start a note or send an SMS/email.
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  placeholder={composerChannel === 'note' ? 'Add an internal note...' : `Send a ${composerChannel.toUpperCase()} to the client...`}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Messages are draft-only for now. Wire this to SMS/email when ready.</p>
                  <button
                    onClick={handleSendMessage}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!draft.trim()}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="relative grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
          <h2 className="text-xl font-semibold text-slate-900">Clients</h2>
          <p className="text-sm text-slate-600">CRM-style list with quick filters, insights, and a detail drawer with chat.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Manage views
          </button>
          <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-600">
            + Add client
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-600">Loading clients...</p>}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {!loading && !error && (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="Search name, email, phone, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <div className="flex flex-wrap items-center gap-2">
              {pillButton('All', statusFilter === 'all', () => setStatusFilter('all'), 'neutral')}
              {pillButton('Active', statusFilter === 'Active', () => setStatusFilter('Active'), 'primary')}
              {pillButton('Prospect', statusFilter === 'Prospect', () => setStatusFilter('Prospect'), 'primary')}
              {pillButton('Inactive', statusFilter === 'Inactive', () => setStatusFilter('Inactive'), 'neutral')}
            </div>
          </div>

          <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="grid grid-cols-[1.4fr,1fr,0.9fr,0.9fr,0.9fr] items-center border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <div>Name</div>
              <div>Location</div>
              <div>Status</div>
              <div>Requests</div>
              <div>Last interaction</div>
            </div>

            {filteredClients.map((client) => (
              <button
                key={client.id}
                onClick={() => setSelectedClientId(client.id)}
                className="grid w-full grid-cols-[1.4fr,1fr,0.9fr,0.9fr,0.9fr] items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-indigo-50/40 focus:bg-indigo-50"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{getFullName(client)}</p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                      {client.role || 'client'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {client.email || 'No email'} • {client.phone || 'No phone'}
                  </p>
                </div>
                <div className="text-sm text-slate-700">
                  {[client.city, client.state, client.postal_code].filter(Boolean).join(', ') || 'No address on file'}
                </div>
                <div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[client.status]}`}>
                    {client.status}
                  </span>
                </div>
                <div className="text-sm text-slate-700">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    Open {client.openRequests}
                  </span>
                  <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    Total {client.totalRequests}
                  </span>
                </div>
                <div className="text-sm text-slate-700">{formatRelativeTime(client.lastInteractionAt)}</div>
              </button>
            ))}

            {!filteredClients.length && (
              <div className="px-4 py-6 text-sm text-slate-600">
                No clients match your filters. Clear filters or add a new client.
              </div>
            )}
          </div>
        </div>
      )}

      {renderDrawer()}
    </section>
  );
}
