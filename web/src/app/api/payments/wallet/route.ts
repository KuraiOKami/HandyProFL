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

export async function GET() {
  if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });

  const { user, error } = await requireUser();
  if (error || !user) return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });

  try {
    const customerId = await getOrCreateCustomer(user.id, user.email ?? undefined);
    const methods = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
    return NextResponse.json({
      payment_methods: methods.data.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        exp_month: pm.card?.exp_month,
        exp_year: pm.card?.exp_year,
      })),
      customer_id: customerId,
    });
  } catch (e) {
    console.error('Error listing payment methods', e);
    const message = e instanceof Error ? e.message : 'Failed to list payment methods';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });

  const { user, error } = await requireUser();
  if (error || !user) return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });

  try {
    const customerId = await getOrCreateCustomer(user.id, user.email ?? undefined);
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: 'off_session',
      payment_method_types: ['card'],
      metadata: { user_id: user.id },
    });
    return NextResponse.json({
      client_secret: setupIntent.client_secret,
      customer_id: customerId,
    });
  } catch (e) {
    console.error('Error creating setup intent', e);
    return NextResponse.json({ error: 'Failed to create setup intent' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });

  const { user, error } = await requireUser();
  if (error || !user) return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const payment_method_id = body?.payment_method_id as string | undefined;
  if (!payment_method_id) return NextResponse.json({ error: 'payment_method_id required' }, { status: 400 });

  try {
    const customerId = await getOrCreateCustomer(user.id, user.email ?? undefined);
    const pm = await stripe.paymentMethods.retrieve(payment_method_id);
    const pmCustomer = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id;
    if (pmCustomer && pmCustomer !== customerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await stripe.paymentMethods.detach(payment_method_id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Error detaching payment method', e);
    return NextResponse.json({ error: 'Failed to remove payment method' }, { status: 500 });
  }
}
