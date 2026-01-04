import PaymentMethodSelector from './PaymentMethodSelector';
import ItemSummary from './ItemSummary';
import type { RequestItem, PaymentMethod } from '@/hooks/useRequestWizard';

type ReviewStepProps = {
  items: RequestItem[];
  getPriceForItem: (item: RequestItem) => number;
  subtotalCents: number;
  urgencyFeeCents: number;
  totalPriceCents: number;
  requiredMinutes: number;
  date: string;
  slot: { time: string; startIso: string } | null;
  // Payment props
  paymentMethods: PaymentMethod[];
  selectedPaymentMethodId: string | null;
  onSelectedPaymentMethodIdChange: (id: string | null) => void;
  walletLoading: boolean;
  walletError: string | null;
  onLoadPaymentMethods: () => void;
  isLoggedIn: boolean;
};

function getUrgencyLabel(feeCents: number): string {
  if (feeCents === 5000) return 'same-day';
  if (feeCents === 3000) return 'next-day';
  if (feeCents === 2000) return '2-day';
  return '';
}

export default function ReviewStep({
  items,
  getPriceForItem,
  subtotalCents,
  urgencyFeeCents,
  totalPriceCents,
  requiredMinutes,
  date,
  slot,
  paymentMethods,
  selectedPaymentMethodId,
  onSelectedPaymentMethodIdChange,
  walletLoading,
  walletError,
  onLoadPaymentMethods,
  isLoggedIn,
}: ReviewStepProps) {
  return (
    <div className="grid gap-3 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">📋</span>
        <p className="text-sm font-semibold text-slate-900">Confirm your booking</p>
      </div>
      <p className="text-xs text-slate-600">Review your request details below. Your card will be charged when you submit.</p>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Items</p>
          <span className="text-xs font-semibold text-indigo-700">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="grid gap-2">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800">
              <ItemSummary
                item={item}
                index={idx}
                bordered={false}
                meta={
                  <span className="text-xs font-semibold text-slate-700">
                    {(getPriceForItem(item) / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                  </span>
                }
              />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-700">Subtotal</span>
          <span className="font-semibold text-slate-900">
            {(subtotalCents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
          </span>
        </div>
        {urgencyFeeCents > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-700">
              Urgency fee
              <span className="ml-1 text-xs text-slate-500">
                ({getUrgencyLabel(urgencyFeeCents)})
              </span>
            </span>
            <span className="font-semibold text-amber-600">
              +{(urgencyFeeCents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-200 pt-2">
          <span className="font-semibold text-slate-900">Total</span>
          <span className="font-bold text-slate-900">
            {(totalPriceCents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-700">Estimated time</span>
          <span className="font-semibold text-slate-900">{requiredMinutes} min</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-700">Selected slot</span>
          <span className="font-semibold text-slate-900">
            {date && slot ? `${date} @ ${slot.time}` : 'Not selected'}
          </span>
        </div>
      </div>
      <PaymentMethodSelector
        paymentMethods={paymentMethods}
        selectedPaymentMethodId={selectedPaymentMethodId}
        onSelectedPaymentMethodIdChange={onSelectedPaymentMethodIdChange}
        walletLoading={walletLoading}
        walletError={walletError}
        onLoadPaymentMethods={onLoadPaymentMethods}
        isLoggedIn={isLoggedIn}
      />
    </div>
  );
}
