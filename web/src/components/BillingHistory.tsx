"use client";

import { useCallback, useEffect, useState } from "react";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

type Charge = {
  id: string;
  amount: number;
  currency: string | null;
  status: string | null;
  created: number | null;
  description: string | null;
  receipt_url: string | null;
  payment_method_details?: {
    brand?: string | null;
    last4?: string | null;
  };
};

type InvoiceResponse = {
  charges?: Charge[];
  error?: string;
};

const formatMoney = (cents: number, currency?: string | null) => {
  const code = (currency ?? "USD").toUpperCase();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    currencyDisplay: "symbol",
  }).format((cents ?? 0) / 100);
};

const formatDate = (timestamp: number | null) => {
  if (!timestamp) return "—";
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function BillingHistory() {
  const { session } = useSupabaseSession();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/payments/invoices");
    const body = (await res.json().catch(() => null)) as InvoiceResponse | null;
    if (!res.ok || !body || body.error) {
      setError(body?.error ?? "Unable to load payment history.");
      setCharges([]);
      setLoading(false);
      return;
    }
    setCharges(body.charges ?? []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  if (!session) {
    return (
      <section className="grid gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">
            Billing
          </p>
          <h2 className="text-xl font-semibold text-slate-900">
            Payment history
          </h2>
        </div>
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Sign in to view your payment history.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">
            Billing
          </p>
          <h2 className="text-xl font-semibold text-slate-900">
            Payment history
          </h2>
          <p className="text-sm text-slate-600">
            View your past payments and download receipts.
          </p>
        </div>
        <button
          onClick={loadPayments}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      {loading && (
        <p className="text-sm text-slate-600">Loading payments...</p>
      )}

      {!loading && !error && charges.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
          No payments yet. Your payment history will appear here after your first transaction.
        </p>
      )}

      {!loading && !error && charges.length > 0 && (
        <div className="grid gap-3">
          {charges.map((charge) => (
            <a
              key={charge.id}
              href={charge.receipt_url ?? "#"}
              target={charge.receipt_url ? "_blank" : undefined}
              rel="noreferrer"
              className={`flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 transition ${
                charge.receipt_url
                  ? "hover:border-indigo-300 hover:bg-indigo-50/50"
                  : "cursor-default"
              }`}
            >
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatMoney(charge.amount, charge.currency)}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                      charge.status === "succeeded"
                        ? "bg-green-50 text-green-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {charge.status === "succeeded" ? "Paid" : charge.status ?? "Pending"}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  {formatDate(charge.created)}
                  {charge.payment_method_details?.brand && (
                    <> · {charge.payment_method_details.brand.toUpperCase()} ····{charge.payment_method_details.last4}</>
                  )}
                </p>
                {charge.description && (
                  <p className="text-xs text-slate-500">{charge.description}</p>
                )}
              </div>
              {charge.receipt_url && (
                <span className="text-sm font-semibold text-indigo-700">
                  View receipt →
                </span>
              )}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
