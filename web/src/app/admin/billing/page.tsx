export default function AdminBillingPage() {
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Billing</h1>
        <p className="text-sm text-slate-600">Invoices, payments, and saved payment methods.</p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        TODO: Integrate with Stripe for invoices/receipts and show balances.
      </div>
    </div>
  );
}
