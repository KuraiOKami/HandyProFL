import type { PaymentMethod } from '@/hooks/useRequestWizard';

type PaymentMethodSelectorProps = {
  payMethod: 'pay_later' | 'card_on_file';
  onPayMethodChange: (method: 'pay_later' | 'card_on_file') => void;
  paymentMethods: PaymentMethod[];
  selectedPaymentMethodId: string | null;
  onSelectPaymentMethod: (id: string) => void;
  walletLoading: boolean;
  walletError: string | null;
  onRefreshCards: () => void;
};

export default function PaymentMethodSelector({
  payMethod,
  onPayMethodChange,
  paymentMethods,
  selectedPaymentMethodId,
  onSelectPaymentMethod,
  walletLoading,
  walletError,
  onRefreshCards,
}: PaymentMethodSelectorProps) {
  const hasPaymentMethods = paymentMethods.length > 0;

  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Payment</p>
        <button
          type="button"
          onClick={onRefreshCards}
          disabled={walletLoading}
          className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {walletLoading ? 'Refreshing…' : 'Refresh cards'}
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-800">
        <input
          type="radio"
          name="pay_method"
          checked={payMethod === 'pay_later'}
          onChange={() => onPayMethodChange('pay_later')}
          className="h-4 w-4 text-indigo-700 focus:ring-indigo-600"
        />
        Pay after confirmation (on-site or link)
      </label>

      <label className={`flex items-center gap-2 text-sm text-slate-800 ${!hasPaymentMethods ? 'opacity-60' : ''}`}>
        <input
          type="radio"
          name="pay_method"
          checked={payMethod === 'card_on_file'}
          onChange={() => onPayMethodChange('card_on_file')}
          disabled={!hasPaymentMethods}
          className="h-4 w-4 text-indigo-700 focus:ring-indigo-600"
        />
        Charge a saved card now
      </label>

      {walletError && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800">{walletError}</p>}

      {payMethod === 'card_on_file' && (
        <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          {hasPaymentMethods ? (
            paymentMethods.map((pm) => (
              <label
                key={pm.id}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                  selectedPaymentMethodId === pm.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-900">
                    {pm.brand ? pm.brand.toUpperCase() : 'Card'} •••• {pm.last4 ?? '••••'}
                  </span>
                  <span className="text-xs text-slate-600">
                    Expires {pm.exp_month ?? '??'}/{pm.exp_year ?? '??'}
                  </span>
                </div>
                <input
                  type="radio"
                  name="selected_payment_method"
                  checked={selectedPaymentMethodId === pm.id}
                  onChange={() => onSelectPaymentMethod(pm.id)}
                  className="h-4 w-4 text-indigo-700 focus:ring-indigo-600"
                />
              </label>
            ))
          ) : (
            <p className="text-sm text-slate-700">
              No saved cards. Add one in{' '}
              <a href="/settings" className="text-indigo-700 underline">
                Settings → Wallet
              </a>
              .
            </p>
          )}
          <p className="text-xs text-slate-500">
            We charge your card now to lock in the booking. Payment is processed securely via Stripe.
          </p>
        </div>
      )}
    </div>
  );
}
