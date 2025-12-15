'use client';

import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

type PaymentMethod = {
  id: string;
  brand?: string | null;
  last4?: string | null;
  exp_month?: number | null;
  exp_year?: number | null;
};

type PaymentMethodSelectorProps = {
  paymentMethods: PaymentMethod[];
  selectedPaymentMethodId: string | null;
  onSelectedPaymentMethodIdChange: (id: string | null) => void;
  walletLoading: boolean;
  walletError: string | null;
  onLoadPaymentMethods: () => void;
  isLoggedIn: boolean;
};

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function AddCardForm({ onCardAdded }: { onCardAdded: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      // Get setup intent from server
      const res = await fetch('/api/payments/wallet', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || 'Failed to create setup intent');
        setLoading(false);
        return;
      }

      const clientSecret = body.client_secret;
      if (!clientSecret) {
        setError('No client secret returned');
        setLoading(false);
        return;
      }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setError('Card element not found');
        setLoading(false);
        return;
      }

      const { error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (stripeError) {
        setError(stripeError.message || 'Card setup failed');
        setLoading(false);
        return;
      }

      setSuccess(true);
      onCardAdded();
    } catch {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        Card added successfully!
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <div className="rounded-lg border border-slate-300 bg-white p-3">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '14px',
                color: '#1e293b',
                '::placeholder': { color: '#94a3b8' },
              },
            },
          }}
        />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={loading || !stripe}
        className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-300"
      >
        {loading ? 'Saving...' : 'Save card'}
      </button>
    </form>
  );
}

export default function PaymentMethodSelector({
  paymentMethods,
  selectedPaymentMethodId,
  onSelectedPaymentMethodIdChange,
  walletLoading,
  walletError,
  onLoadPaymentMethods,
  isLoggedIn,
}: PaymentMethodSelectorProps) {
  const [showAddCard, setShowAddCard] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      onLoadPaymentMethods();
    }
  }, [isLoggedIn, onLoadPaymentMethods]);

  const handleCardAdded = () => {
    setShowAddCard(false);
    onLoadPaymentMethods();
  };

  if (!isLoggedIn) {
    return (
      <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-900">Payment</p>
        <p className="text-sm text-slate-700">Sign in to pay with a saved card or add a new one.</p>
        <p className="text-xs text-slate-500">Secure payment processing via Stripe.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-900">Payment Method</p>
      <p className="text-xs text-slate-600">Your card will be charged when you submit the request.</p>

      {walletLoading && <p className="text-xs text-slate-500">Loading saved cards...</p>}
      {walletError && <p className="text-xs text-rose-600">{walletError}</p>}

      {/* Saved cards */}
      {!walletLoading && paymentMethods.length > 0 && (
        <div className="grid gap-2">
          {paymentMethods.map((pm) => (
            <label
              key={pm.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                selectedPaymentMethodId === pm.id
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 bg-white hover:border-indigo-300'
              }`}
            >
              <input
                type="radio"
                name="selectedCard"
                value={pm.id}
                checked={selectedPaymentMethodId === pm.id}
                onChange={() => onSelectedPaymentMethodIdChange(pm.id)}
                className="h-4 w-4 text-indigo-600"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900 capitalize">{pm.brand || 'Card'}</span>
                <span className="text-sm text-slate-600">•••• {pm.last4}</span>
                {pm.exp_month && pm.exp_year && (
                  <span className="text-xs text-slate-500">
                    {pm.exp_month}/{String(pm.exp_year).slice(-2)}
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>
      )}

      {!walletLoading && paymentMethods.length === 0 && !showAddCard && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">No payment method on file. Add a card to continue.</p>
        </div>
      )}

      {/* Add new card */}
      {!showAddCard ? (
        <button
          type="button"
          onClick={() => setShowAddCard(true)}
          className="inline-flex items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50"
        >
          <span>+</span> Add new card
        </button>
      ) : (
        stripePromise && (
          <Elements stripe={stripePromise}>
            <AddCardForm onCardAdded={handleCardAdded} />
          </Elements>
        )
      )}

      <p className="text-xs text-slate-500">Secure payment processing via Stripe.</p>
    </div>
  );
}
