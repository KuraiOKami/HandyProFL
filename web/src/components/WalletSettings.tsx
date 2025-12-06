"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

type PaymentMethod = {
  id: string;
  brand?: string | null;
  last4?: string | null;
  exp_month?: number | null;
  exp_year?: number | null;
};

type AddCardFormProps = {
  clientSecret: string;
  onComplete: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
};

const cardElementOptions = {
  hidePostalCode: true,
  style: {
    base: {
      fontSize: "16px",
      color: "#0f172a",
      "::placeholder": {
        color: "#94a3b8",
      },
    },
    invalid: {
      color: "#e11d48",
    },
  },
};

function AddCardForm({
  clientSecret,
  onComplete,
  onError,
  onCancel,
}: AddCardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements) {
      onError("Stripe failed to initialize. Reload and try again.");
      return;
    }
    const card = elements.getElement(CardElement);
    if (!card) {
      onError("Card field is not ready yet.");
      return;
    }
    setSaving(true);
    const { error, setupIntent } = await stripe.confirmCardSetup(
      clientSecret,
      {
        payment_method: { card },
      }
    );
    if (error) {
      onError(error.message ?? "We could not save the card.");
      setSaving(false);
      return;
    }
    if (setupIntent?.status === "succeeded") {
      onComplete();
    } else {
      onError("We could not confirm the card. Please try again.");
    }
    setSaving(false);
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-inner shadow-slate-100"
    >
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
        <CardElement options={cardElementOptions} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={saving || !stripe || !elements}
          className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saving ? "Saving..." : "Save card"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <p className="text-xs text-slate-500">
          Cards are vaulted with Stripe for off-session confirmations.
        </p>
      </div>
    </form>
  );
}

export default function WalletSettings() {
  const { session } = useSupabaseSession();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canUseStripe = Boolean(stripePromise && publishableKey);

  const loadWallet = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/payments/wallet");
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(body?.error ?? "Unable to load wallet.");
      setPaymentMethods([]);
      setLoading(false);
      return;
    }
    const body = (await res.json()) as {
      payment_methods?: PaymentMethod[];
    };
    setPaymentMethods(body.payment_methods ?? []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const startAddCard = async () => {
    setPreparing(true);
    setStatus(null);
    setError(null);
    const res = await fetch("/api/payments/wallet", { method: "POST" });
    const body = (await res.json().catch(() => null)) as
      | { client_secret?: string; error?: string }
      | null;
    if (!res.ok || !body?.client_secret) {
      setError(body?.error ?? "Could not start card setup.");
      setPreparing(false);
      return;
    }
    setClientSecret(body.client_secret);
    setShowForm(true);
    setPreparing(false);
  };

  const removeCard = async (id: string) => {
    setDeletingId(id);
    setStatus(null);
    setError(null);
    const res = await fetch("/api/payments/wallet", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_method_id: id }),
    });
    const body = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    if (!res.ok) {
      setError(body?.error ?? "Failed to remove card.");
      setDeletingId(null);
      return;
    }
    setPaymentMethods((prev) => prev.filter((pm) => pm.id !== id));
    setStatus("Card removed.");
    setDeletingId(null);
  };

  const brandLabel = (brand?: string | null) => {
    if (!brand) return "Card";
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  return (
    <section className="grid gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">
            Billing
          </p>
          <h2 className="text-xl font-semibold text-slate-900">Wallet</h2>
          <p className="text-sm text-slate-600">
            Vault a card for quick confirmations and off-session charges.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startAddCard}
            disabled={!session || !canUseStripe || preparing || showForm}
            className="rounded-lg bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {preparing ? "Preparing..." : "Add card"}
          </button>
          <button
            onClick={loadWallet}
            disabled={!session || loading}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh
          </button>
        </div>
      </div>

      {!canUseStripe && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Add <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>{" "}
          to enable card entry.
        </p>
      )}

      {!session && (
        <p className="text-sm text-amber-700">Sign in to manage saved cards.</p>
      )}

      {error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}
      {status && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {status}
        </p>
      )}

      {session && (
        <div className="grid gap-3">
          {loading && (
            <p className="text-sm text-slate-600">Loading saved cards...</p>
          )}
          {!loading &&
            paymentMethods.map((pm) => (
              <div
                key={pm.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    {brandLabel(pm.brand)}
                  </span>
                  <div className="grid gap-1">
                    <p className="text-sm font-semibold text-slate-900">
                      •••• {pm.last4 ?? "••••"}
                    </p>
                    <p className="text-xs text-slate-600">
                      Expires{" "}
                      {pm.exp_month && pm.exp_year
                        ? `${pm.exp_month}/${pm.exp_year}`
                        : "—"}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      {pm.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeCard(pm.id)}
                  disabled={deletingId === pm.id}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === pm.id ? "Removing..." : "Remove"}
                </button>
              </div>
            ))}
          {!loading && !paymentMethods.length && (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              No saved cards yet. Add one to streamline booking confirmations.
            </p>
          )}
        </div>
      )}

      {session && showForm && clientSecret && stripePromise && (
        <Elements stripe={stripePromise} options={{}} key={clientSecret}>
          <AddCardForm
            clientSecret={clientSecret}
            onComplete={() => {
              setShowForm(false);
              setClientSecret(null);
              setStatus("Card saved and ready for bookings.");
              loadWallet();
            }}
            onError={(message) => setError(message)}
            onCancel={() => {
              setShowForm(false);
              setClientSecret(null);
            }}
          />
        </Elements>
      )}
    </section>
  );
}
