"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

type Invoice = {
  id: string;
  number: string | null;
  status: string | null;
  total: number;
  amount_paid: number;
  amount_remaining: number;
  currency: string | null;
  created: number | null;
  due_date: number | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  receipt_url: string | null;
};

type InvoiceResponse = {
  customer_id: string;
  balance_cents: number;
  currency: string | null;
  open_amount_cents: number;
  invoices: Invoice[];
  charges?: Charge[];
  livemode: boolean | null;
  invoice_count?: number;
  error?: string;
};

type Charge = {
  id: string;
  amount: number;
  currency: string | null;
  status: string | null;
  created: number | null;
  description: string | null;
  receipt_url: string | null;
  invoice: string | null;
  payment_method_details?: {
    brand?: string | null;
    last4?: string | null;
    exp_month?: number | null;
    exp_year?: number | null;
  };
};

const formatMoney = (cents: number, currency?: string | null) => {
  const code = (currency ?? "USD").toUpperCase();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    currencyDisplay: "symbol",
  }).format((cents ?? 0) / 100);
};

const statusTone = (status?: string | null) => {
  switch (status) {
    case "paid":
      return "bg-green-50 text-green-800 border-green-200";
    case "open":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "uncollectible":
      return "bg-rose-50 text-rose-800 border-rose-200";
    case "void":
      return "bg-slate-50 text-slate-700 border-slate-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

const statusLabel = (status?: string | null) => {
  if (!status) return "Pending";
  return status.charAt(0).toUpperCase() + status.slice(1);
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
  const [data, setData] = useState<InvoiceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = data?.currency ?? "usd";

  const loadInvoices = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/payments/invoices");
    const body = (await res.json().catch(() => null)) as InvoiceResponse | null;
    if (!res.ok || !body || body.error) {
      setError(body?.error ?? "Unable to load invoices right now.");
      setData(null);
      setLoading(false);
      return;
    }
    setData(body);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const openInvoices = useMemo(
    () => (data?.invoices ?? []).filter((inv) => inv.status === "open"),
    [data]
  );

  if (!session) {
    return (
      <section className="grid gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">
            Billing
          </p>
          <h2 className="text-xl font-semibold text-slate-900">
            Invoices & receipts
          </h2>
          <p className="text-sm text-slate-600">
            Sign in to view your invoices, receipts, and balances.
          </p>
        </div>
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You need to sign in to view billing history.
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
            Invoices & receipts
          </h2>
          <p className="text-sm text-slate-600">
            View balances, download invoices, and grab receipt links from
            Stripe.
          </p>
        </div>
        <button
          onClick={loadInvoices}
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

      {!error && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-600">
              Customer balance
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              {data ? formatMoney(data.balance_cents, currency) : "—"}
            </p>
            <p className="text-xs text-slate-600">
              Applies automatically to invoices. Positive = credit, negative =
              amount due.
            </p>
          </div>
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-600">
              Open invoices
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              {data ? formatMoney(data.open_amount_cents, currency) : "—"}
            </p>
            <p className="text-xs text-slate-600">
              {openInvoices.length
                ? `${openInvoices.length} open invoice${openInvoices.length === 1 ? "" : "s"}.`
                : "No open invoices."}
            </p>
          </div>
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-600">
              Customer ID
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {data?.customer_id ?? "—"}
            </p>
            <p className="text-xs text-slate-600">
              Shared with Stripe for receipts and payments.
            </p>
          </div>
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-600">
              Stripe mode
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {data?.livemode == null ? "—" : data.livemode ? "Live" : "Test"}
            </p>
            <p className="text-xs text-slate-600">
              Make sure this matches where your invoices live.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {!loading && !error && data?.charges && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-600">
                  Recent charges
                </p>
                <p className="text-sm text-slate-600">
                  PaymentIntents/charges for this customer (most recent 15).
                </p>
              </div>
              <p className="text-xs text-slate-600">
                Mode: {data.livemode == null ? "—" : data.livemode ? "Live" : "Test"}
              </p>
            </div>
            <div className="mt-3 grid gap-3">
              {data.charges.length === 0 && (
                <p className="text-sm text-slate-700">
                  No charges yet for this customer in this mode.
                </p>
              )}
              {data.charges.map((charge) => (
                <div
                  key={charge.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                        {charge.status ?? "—"}
                      </span>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatMoney(charge.amount, charge.currency ?? currency)}
                      </p>
                      <p className="text-xs text-slate-600">{formatDate(charge.created)}</p>
                    </div>
                    <p className="text-xs text-slate-600">
                      {charge.payment_method_details?.brand
                        ? `${charge.payment_method_details.brand.toUpperCase()} •••• ${
                            charge.payment_method_details.last4 ?? "••••"
                          }`
                        : "Payment method unknown"}
                    </p>
                    {charge.invoice && (
                      <p className="text-xs text-slate-500">Invoice: {charge.invoice}</p>
                    )}
                    {charge.description && (
                      <p className="text-xs text-slate-500">Description: {charge.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {charge.receipt_url && (
                      <a
                        href={charge.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-700 underline underline-offset-4"
                      >
                        Receipt
                      </a>
                    )}
                    {!charge.receipt_url && (
                      <p className="text-xs text-slate-500">No receipt link</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <p className="text-sm text-slate-600">Loading invoices...</p>
        )}
        {!loading && !error && (!data || !data.invoices.length) && (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
            No invoices yet. You&apos;ll see invoices and receipts here once
            billing begins.
          </p>
        )}
        {!loading &&
          !error &&
          data?.invoices?.map((invoice) => (
            <div
              key={invoice.id}
              className="grid gap-3 rounded-lg border border-slate-200 p-4 shadow-inner shadow-slate-100"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusTone(
                        invoice.status
                      )}`}
                    >
                      {statusLabel(invoice.status)}
                    </span>
                    <p className="text-sm font-semibold text-slate-900">
                      {invoice.number ? `Invoice ${invoice.number}` : invoice.id}
                    </p>
                  </div>
                  <p className="text-xs text-slate-600">
                    Created {formatDate(invoice.created)}
                    {invoice.due_date ? ` · Due ${formatDate(invoice.due_date)}` : ""}
                  </p>
                </div>
                <p className="text-lg font-semibold text-slate-900">
                  {formatMoney(invoice.total, invoice.currency ?? currency)}
                </p>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                <div>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Paid
                  </span>
                  <p className="font-semibold">
                    {formatMoney(invoice.amount_paid, invoice.currency ?? currency)}
                  </p>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Remaining
                  </span>
                  <p className="font-semibold">
                    {formatMoney(
                      invoice.amount_remaining,
                      invoice.currency ?? currency
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {invoice.hosted_invoice_url && (
                  <a
                    href={invoice.hosted_invoice_url}
                    className="text-indigo-700 underline underline-offset-4"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View invoice
                  </a>
                )}
                {invoice.invoice_pdf && (
                  <a
                    href={invoice.invoice_pdf}
                    className="text-indigo-700 underline underline-offset-4"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download PDF
                  </a>
                )}
                {invoice.receipt_url && (
                  <a
                    href={invoice.receipt_url}
                    className="text-indigo-700 underline underline-offset-4"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Receipt
                  </a>
                )}
                {!invoice.hosted_invoice_url &&
                  !invoice.invoice_pdf &&
                  !invoice.receipt_url && (
                    <p className="text-xs text-slate-600">
                      No links available for this invoice yet.
                    </p>
                  )}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
