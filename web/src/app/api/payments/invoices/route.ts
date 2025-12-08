import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { getOrCreateCustomer } from '@/lib/stripeCustomer';
import { createClient } from '@/utils/supabase/server';

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' as const };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: 'Unauthorized' as const };
  return { user: data.user };
}

type ChargeSummary = {
  id: string;
  amount: number;
  currency: string | null;
  status: Stripe.Charge.Status | null;
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

export async function GET() {
  if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });

  const { user, error } = await requireUser();
  if (error || !user) return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });

  try {
    const customerId = await getOrCreateCustomer(user.id, user.email ?? undefined);

    const customer = await stripe.customers.retrieve(customerId);
    if (!customer || (typeof customer === 'object' && 'deleted' in customer && customer.deleted)) {
      return NextResponse.json({ error: 'Stripe customer missing' }, { status: 404 });
    }

    const { data: invoices } = await stripe.invoices.list({
      customer: customerId,
      limit: 15,
      expand: ['data.payments.payment.charge'],
    });

    const { data: charges } = await stripe.charges.list({
      customer: customerId,
      limit: 15,
    });

    const openAmountCents = invoices.reduce((sum, invoice) => {
      const isOpen = invoice.status === 'open' || invoice.status === 'uncollectible';
      if (!isOpen) return sum;
      const amount = invoice.amount_remaining ?? invoice.total ?? 0;
      return sum + (amount ?? 0);
    }, 0);

    const normalizedInvoices = invoices.map((invoice) => {
      // In Stripe v20+, receipt_url is accessed via payments.data[].payment.charge
      let receiptUrl: string | null = null;
      const payments = invoice.payments?.data;
      if (payments && payments.length > 0) {
        for (const paymentEntry of payments) {
          const charge = paymentEntry.payment?.charge;
          if (typeof charge === 'object' && charge?.receipt_url) {
            receiptUrl = charge.receipt_url;
            break;
          }
        }
      }

      return {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        total: invoice.total ?? 0,
        amount_paid: invoice.amount_paid ?? 0,
        amount_remaining: invoice.amount_remaining ?? 0,
        currency: invoice.currency ?? (customer as Stripe.Customer).currency ?? 'usd',
        created: invoice.created ?? null,
        due_date: invoice.due_date ?? null,
        hosted_invoice_url: invoice.hosted_invoice_url ?? null,
        invoice_pdf: invoice.invoice_pdf ?? null,
        receipt_url: receiptUrl,
      };
    });

    return NextResponse.json({
      customer_id: customerId,
      balance_cents: (customer as Stripe.Customer).balance ?? 0,
      currency: (customer as Stripe.Customer).currency ?? normalizedInvoices[0]?.currency ?? 'usd',
      open_amount_cents: openAmountCents,
      livemode: (customer as Stripe.Customer).livemode ?? null,
      invoice_count: normalizedInvoices.length,
      invoices: normalizedInvoices,
      charges: charges.map<ChargeSummary>((charge) => ({
        id: charge.id,
        amount: charge.amount ?? 0,
        currency: charge.currency ?? (customer as Stripe.Customer).currency ?? 'usd',
        status: charge.status ?? null,
        created: charge.created ?? null,
        description: charge.description ?? null,
        receipt_url: charge.receipt_url ?? null,
        invoice: typeof charge.invoice === 'string' ? charge.invoice : charge.invoice?.id ?? null,
        payment_method_details: {
          brand: charge.payment_method_details?.card?.brand ?? null,
          last4: charge.payment_method_details?.card?.last4 ?? null,
          exp_month: charge.payment_method_details?.card?.exp_month ?? null,
          exp_year: charge.payment_method_details?.card?.exp_year ?? null,
        },
      })),
    });
  } catch (e) {
    console.error('Error loading invoices', e);
    const message = e instanceof Error ? e.message : 'Failed to load invoices';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
