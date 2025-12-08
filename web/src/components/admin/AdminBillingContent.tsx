'use client';

import BillingHistory from '../BillingHistory';

export default function AdminBillingContent() {
  return (
    <section className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h2 className="text-xl font-semibold text-slate-900">Billing</h2>
        <p className="text-sm text-slate-600">Invoices, payments, and saved payment methods.</p>
      </div>
      <BillingHistory />
    </section>
  );
}
