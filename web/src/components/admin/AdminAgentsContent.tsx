'use client';

import { useEffect, useState } from 'react';

type Agent = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  rating: number;
  total_jobs: number;
  total_earnings_cents: number;
  skills: string[];
  stripe_payouts_enabled: boolean;
  created_at: string;
};

export default function AdminAgentsContent() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'suspended'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/agents');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load agents');
      }

      setAgents(data.agents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (agentId: string) => {
    setActionLoading(agentId);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}/approve`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve agent');
      }

      await loadAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve agent');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (agentId: string) => {
    setActionLoading(agentId);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}/suspend`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to suspend agent');
      }

      await loadAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suspend agent');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspend = async (agentId: string) => {
    setActionLoading(agentId);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}/approve`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to unsuspend agent');
      }

      await loadAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unsuspend agent');
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">Approved</span>;
      case 'pending_approval':
        return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">Pending</span>;
      case 'suspended':
        return <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700">Suspended</span>;
      default:
        return null;
    }
  };

  const getFilteredAgents = () => {
    switch (filter) {
      case 'pending':
        return agents.filter((a) => a.status === 'pending_approval');
      case 'approved':
        return agents.filter((a) => a.status === 'approved');
      case 'suspended':
        return agents.filter((a) => a.status === 'suspended');
      default:
        return agents;
    }
  };

  const filteredAgents = getFilteredAgents();
  const pendingCount = agents.filter((a) => a.status === 'pending_approval').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-700"></div>
          <p className="text-sm text-slate-600">Loading agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Total Agents</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{agents.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Pending Approval</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Active</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {agents.filter((a) => a.status === 'approved').length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Total Jobs Completed</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {agents.reduce((sum, a) => sum + a.total_jobs, 0)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Filter:</span>
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {(['all', 'pending', 'approved', 'suspended'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  filter === f
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f === 'all' ? 'All' : f === 'pending' ? `Pending (${pendingCount})` : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={loadAgents}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Agents Table */}
      {filteredAgents.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
          <div className="mb-3 text-4xl">👥</div>
          <p className="text-lg font-medium text-slate-900">No agents found</p>
          <p className="mt-1 text-sm text-slate-500">
            {filter === 'pending' ? 'No pending applications' : 'Agents will appear here once they apply'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Agent
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Jobs
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Earnings
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Rating
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Payment
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAgents.map((agent) => (
                <tr key={agent.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <div>
                      <p className="font-medium text-slate-900">
                        {agent.first_name} {agent.last_name}
                      </p>
                      <p className="text-sm text-slate-500">{agent.email}</p>
                      {agent.phone && <p className="text-sm text-slate-500">{agent.phone}</p>}
                    </div>
                  </td>
                  <td className="px-5 py-4">{getStatusBadge(agent.status)}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{agent.total_jobs}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{formatCurrency(agent.total_earnings_cents)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-500">⭐</span>
                      <span className="font-medium text-slate-900">{agent.rating.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {agent.stripe_payouts_enabled ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Connected
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Not Setup
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {agent.status === 'pending_approval' && (
                        <button
                          onClick={() => handleApprove(agent.id)}
                          disabled={actionLoading === agent.id}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-400"
                        >
                          {actionLoading === agent.id ? '...' : 'Approve'}
                        </button>
                      )}
                      {agent.status === 'approved' && (
                        <button
                          onClick={() => handleSuspend(agent.id)}
                          disabled={actionLoading === agent.id}
                          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:bg-rose-400"
                        >
                          {actionLoading === agent.id ? '...' : 'Suspend'}
                        </button>
                      )}
                      {agent.status === 'suspended' && (
                        <button
                          onClick={() => handleUnsuspend(agent.id)}
                          disabled={actionLoading === agent.id}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-400"
                        >
                          {actionLoading === agent.id ? '...' : 'Reactivate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
