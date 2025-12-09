export default function PaymentMethodSelector() {
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-900">Payment</p>
      <p className="text-sm text-slate-700">
        Payment will be collected after service confirmation. We&apos;ll send you a payment link via email/SMS.
      </p>
      <p className="text-xs text-slate-500">
        Secure payment processing via Stripe.
      </p>
    </div>
  );
}
