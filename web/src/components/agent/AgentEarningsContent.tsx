'use client';

import { useEffect, useState } from 'react';

type EarningsStats = {
  availableBalance: number;
  pendingBalance: number;
  totalEarnings: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
  completedJobs: number;
};

type Earning = {
  id: string;
  assignment_id: string;
  amount_cents: number;
  status: string;
  available_at: string;
  service_type: string;
  completed_at: string;
};

type Payout = {
  id: string;
  amount_cents: number;
  net_amount_cents: number;
  type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
};

export default function AgentEarningsContent() {
  const [stats, setStats] = useState<EarningsStats>({
    availableBalance: 0,
    pendingBalance: 0,
    totalEarnings: 0,
    weeklyEarnings: 0,
    monthlyEarnings: 0,
    completedJobs: 0,
  });
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cashingOut, setCashingOut] = useState(false);
  const [activeView, setActiveView] = useState<'earnings' | 'payouts'>('earnings');

  useEffect(() => {
    loadEarnings();
  }, []);

  const loadEarnings = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agent/earnings');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load earnings');
      }

      setStats(data.stats || {
        availableBalance: 0,
        pendingBalance: 0,
        totalEarnings: 0,
        weeklyEarnings: 0,
        monthlyEarnings: 0,
        completedJobs: 0,
      });
      setEarnings(data.earnings || []);
      setPayouts(data.payouts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load earnings');
    } finally {
      setLoading(false);
    }
  };

  const handleInstantCashout = async () => {
    if (stats.availableBalance < 100) {
      setError('Minimum cashout amount is $1.00');
      return;
    }

    setCashingOut(true);
    setError(null);

    try {
      const res = await fetch('/api/agent/payouts/instant', {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process cashout');
      }

      // Refresh earnings data
      await loadEarnings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process cashout');
    } finally {
      setCashingOut(false);
    }
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Available</span>;
      case 'pending':
        return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Pending</span>;
      case 'paid_out':
        return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Paid Out</span>;
      case 'completed':
        return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Completed</span>;
      case 'processing':
        return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Processing</span>;
      case 'failed':
        return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Failed</span>;
      default:
        return null;
    }
  };

  // Calculate instant cashout fee (1.5%, min $0.50)
  const instantFee = Math.max(50, Math.round(stats.availableBalance * 0.015));
  const netInstantAmount = stats.availableBalance - instantFee;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700"></div>
          <p className="text-sm text-slate-600">Loading earnings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Available Balance */}
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
          <p className="text-sm font-medium text-emerald-700">Available Balance</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{formatCurrency(stats.availableBalance)}</p>
          <p className="mt-1 text-xs text-emerald-600/70">Ready to cash out</p>
        </div>

        {/* Pending Balance */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Pending Balance</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(stats.pendingBalance)}</p>
          <p className="mt-1 text-xs text-slate-500">Available in &lt;2 hours</p>
        </div>

        {/* Weekly Earnings */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-600">This Week</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(stats.weeklyEarnings)}</p>
          <p className="mt-1 text-xs text-slate-500">{stats.completedJobs} jobs completed</p>
        </div>
      </div>

      {/* Cashout Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Cash Out</h3>
        <p className="mt-1 text-sm text-slate-500">Transfer your available balance to your bank account</p>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Weekly Payout */}
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Weekly Payout</p>
                <p className="text-sm text-slate-500">Every Monday, no fees</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">Free</span>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Your available balance will be automatically transferred every Monday.
            </p>
          </div>

          {/* Instant Payout */}
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Instant Payout</p>
                <p className="text-sm text-slate-500">Get paid now, 1.5% fee</p>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                -{formatCurrency(instantFee)}
              </span>
            </div>
            {stats.availableBalance > 0 ? (
              <>
                <p className="mt-3 text-sm text-slate-600">
                  You&apos;ll receive {formatCurrency(netInstantAmount)} after fees.
                </p>
                <button
                  onClick={handleInstantCashout}
                  disabled={cashingOut || stats.availableBalance < 100}
                  className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
                >
                  {cashingOut ? 'Processing...' : `Cash Out ${formatCurrency(stats.availableBalance)}`}
                </button>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No available balance to cash out.</p>
            )}
          </div>
        </div>
      </div>

      {/* Earnings / Payouts Tabs */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveView('earnings')}
              className={`flex-1 border-b-2 px-4 py-3 text-sm font-medium transition ${
                activeView === 'earnings'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Earnings History
            </button>
            <button
              onClick={() => setActiveView('payouts')}
              className={`flex-1 border-b-2 px-4 py-3 text-sm font-medium transition ${
                activeView === 'payouts'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Payout History
            </button>
          </div>
        </div>

        {activeView === 'earnings' ? (
          earnings.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="mb-3 text-4xl">💰</div>
              <p className="text-slate-600">No earnings yet</p>
              <p className="mt-1 text-sm text-slate-500">Complete jobs to start earning</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {earnings.map((earning) => (
                <div key={earning.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-medium text-slate-900">{formatServiceType(earning.service_type)}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(earning.completed_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(earning.status)}
                    <p className="text-lg font-semibold text-emerald-600">+{formatCurrency(earning.amount_cents)}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : payouts.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="mb-3 text-4xl">📤</div>
            <p className="text-slate-600">No payouts yet</p>
            <p className="mt-1 text-sm text-slate-500">Your first payout will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {payouts.map((payout) => (
              <div key={payout.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {payout.type === 'instant' ? 'Instant Payout' : 'Weekly Payout'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {new Date(payout.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(payout.status)}
                  <p className="text-lg font-semibold text-slate-900">{formatCurrency(payout.net_amount_cents)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
