'use client';

import { useCallback, useEffect, useState } from 'react';

type StripeStats = {
  gross_volume_today: number;
  gross_volume_yesterday: number;
  gross_volume_7d: number;
  net_volume_7d: number;
  usd_balance: number;
  pending_payouts: number;
  successful_payments_7d: number;
  failed_payments_7d: number;
  currency: string;
  livemode: boolean;
};

type Charge = {
  id: string;
  amount: number;
  currency: string | null;
  status: string | null;
  created: number | null;
  description: string | null;
  receipt_url: string | null;
  customer_email?: string | null;
  payment_method_details?: {
    brand?: string | null;
    last4?: string | null;
  };
};

const formatMoney = (cents: number, currency?: string) => {
  const code = (currency ?? 'USD').toUpperCase();
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    currencyDisplay: 'symbol',
  }).format((cents ?? 0) / 100);
};

const formatDate = (timestamp: number | null) => {
  if (!timestamp) return '—';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function AdminBillingContent() {
  const [stats, setStats] = useState<StripeStats | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBillingData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/billing');
      const body = await res.json().catch(() => null);

      if (!res.ok || body?.error) {
        setError(body?.error ?? 'Unable to load billing data.');
        return;
      }

      setStats(body.stats ?? null);
      setCharges(body.charges ?? []);
    } catch {
      setError('Failed to connect to billing service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  return (
    <section className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
          <h2 className="text-xl font-semibold text-slate-900">Billing Overview</h2>
          <p className="text-sm text-slate-600">
            Revenue metrics, payouts, and recent transactions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              stats.livemode
                ? 'bg-green-50 text-green-700'
                : 'bg-amber-50 text-amber-700'
            }`}>
              {stats.livemode ? 'Live mode' : 'Test mode'}
            </span>
          )}
          <button
            onClick={loadBillingData}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      )}

      {loading && !stats && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-700"></div>
            <p className="text-sm text-slate-600">Loading billing data...</p>
          </div>
        </div>
      )}

      {stats && (
        <>
          {/* Revenue Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatMoney(stats.gross_volume_today, stats.currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Gross volume</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Yesterday</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatMoney(stats.gross_volume_yesterday, stats.currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Gross volume</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last 7 days</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatMoney(stats.gross_volume_7d, stats.currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Gross volume</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Net volume (7d)</p>
              <p className="mt-1 text-2xl font-bold text-green-600">
                {formatMoney(stats.net_volume_7d, stats.currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500">After Stripe fees</p>
            </div>
          </div>

          {/* Balance & Payments */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">USD Balance</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {formatMoney(stats.usd_balance, stats.currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Available for payout</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Successful (7d)</p>
              <p className="mt-1 text-xl font-bold text-green-600">
                {stats.successful_payments_7d}
              </p>
              <p className="mt-1 text-xs text-slate-500">Payments</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Failed (7d)</p>
              <p className="mt-1 text-xl font-bold text-rose-600">
                {stats.failed_payments_7d}
              </p>
              <p className="mt-1 text-xs text-slate-500">Payments</p>
            </div>
          </div>
        </>
      )}

      {/* Recent Transactions */}
      <div className="grid gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Recent transactions</h3>

        {charges.length === 0 && !loading && (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
            No transactions yet.
          </p>
        )}

        {charges.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Amount</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Customer</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Date</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Card</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {charges.map((charge) => (
                  <tr key={charge.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {formatMoney(charge.amount, charge.currency ?? stats?.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                          charge.status === 'succeeded'
                            ? 'bg-green-50 text-green-700'
                            : charge.status === 'failed'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {charge.status ?? 'pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {charge.customer_email ?? charge.description ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(charge.created)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {charge.payment_method_details?.brand
                        ? `${charge.payment_method_details.brand.toUpperCase()} ····${charge.payment_method_details.last4}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {charge.receipt_url ? (
                        <a
                          href={charge.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-700 hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stripe Dashboard Link */}
      <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 p-4">
        <p className="text-sm text-indigo-900">
          For detailed analytics, payouts, and customer management, visit your{' '}
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-indigo-700 underline underline-offset-2"
          >
            Stripe Dashboard →
          </a>
        </p>
      </div>
    </section>
  );
}
