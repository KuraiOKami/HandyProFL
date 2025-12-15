import PaymentMethodSelector from './PaymentMethodSelector';
import ItemSummary from './ItemSummary';
import type { RequestItem, PaymentMethod } from '@/hooks/useRequestWizard';

type ReviewStepProps = {
  items: RequestItem[];
  getPriceForItem: (item: RequestItem) => number;
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

export default function ReviewStep({
  items,
  getPriceForItem,
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
    <div className="grid gap-3 rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-900">Review & payment</p>
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
