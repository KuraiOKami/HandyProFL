import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { stripe } from '@/lib/stripe';

export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
    }

    // Get time boundaries
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch charges from Stripe (last 100)
    const chargesResponse = await stripe.charges.list({
      limit: 100,
      created: { gte: Math.floor(sevenDaysAgo.getTime() / 1000) },
    });

    const allCharges = chargesResponse.data;

    // Calculate stats
    let grossVolumeToday = 0;
    let grossVolumeYesterday = 0;
    let grossVolume7d = 0;
    let netVolume7d = 0;
    let successfulPayments7d = 0;
    let failedPayments7d = 0;

    for (const charge of allCharges) {
      const chargeDate = new Date(charge.created * 1000);
      const amount = charge.amount;

      if (charge.status === 'succeeded') {
        grossVolume7d += amount;
        successfulPayments7d++;

        // Estimate net (Stripe takes ~2.9% + $0.30)
        const stripeFee = Math.round(amount * 0.029 + 30);
        netVolume7d += amount - stripeFee;

        if (chargeDate >= startOfToday) {
          grossVolumeToday += amount;
        } else if (chargeDate >= startOfYesterday && chargeDate < startOfToday) {
          grossVolumeYesterday += amount;
        }
      } else if (charge.status === 'failed') {
        failedPayments7d++;
      }
    }

    // Get balance
    const balance = await stripe.balance.retrieve();
    const usdBalance = balance.available.find((b) => b.currency === 'usd')?.amount ?? 0;
    const pendingBalance = balance.pending.find((b) => b.currency === 'usd')?.amount ?? 0;

    // Get recent charges for table (last 25)
    const recentChargesResponse = await stripe.charges.list({ limit: 25 });
    const recentCharges = recentChargesResponse.data.map((charge) => ({
      id: charge.id,
      amount: charge.amount,
      currency: charge.currency,
      status: charge.status,
      created: charge.created,
      description: charge.description,
      receipt_url: charge.receipt_url,
      customer_email: charge.billing_details?.email ?? null,
      payment_method_details: charge.payment_method_details?.card
        ? {
            brand: charge.payment_method_details.card.brand,
            last4: charge.payment_method_details.card.last4,
          }
        : null,
    }));

    return NextResponse.json({
      stats: {
        gross_volume_today: grossVolumeToday,
        gross_volume_yesterday: grossVolumeYesterday,
        gross_volume_7d: grossVolume7d,
        net_volume_7d: netVolume7d,
        usd_balance: usdBalance,
        pending_payouts: pendingBalance,
        successful_payments_7d: successfulPayments7d,
        failed_payments_7d: failedPayments7d,
        currency: 'usd',
        livemode: balance.livemode,
      },
      charges: recentCharges,
    });
  } catch (err) {
    console.error('Admin billing error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch billing data' },
      { status: 500 }
    );
  }
}
