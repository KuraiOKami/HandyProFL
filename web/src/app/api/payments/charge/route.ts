import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });

  const { user, error } = await requireUser();
  if (error || !user) return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { amount_cents, currency = 'usd', payment_method_id, request_id } = body as {
    amount_cents?: number;
    currency?: string;
    payment_method_id?: string;
    request_id?: string;
  };

  if (!amount_cents || amount_cents <= 0) {
    return NextResponse.json({ error: 'amount_cents must be > 0' }, { status: 400 });
  }
  if (!payment_method_id) {
    return NextResponse.json({ error: 'payment_method_id required' }, { status: 400 });
  }

  try {
    const customerId = await getOrCreateCustomer(user.id, user.email ?? undefined);

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount_cents),
      currency,
      customer: customerId,
      payment_method: payment_method_id,
      off_session: true,
      confirm: true,
      automatic_payment_methods: { enabled: true },
      metadata: {
        user_id: user.id,
        request_id: request_id ?? '',
      },
    });

    return NextResponse.json({ payment_intent_id: intent.id, status: intent.status });
  } catch (e) {
    console.error('Error creating payment intent', e);
    return NextResponse.json({ error: 'Charge failed' }, { status: 400 });
  }
}
