import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

// Instant payout fee: 1.5% with $0.50 minimum
const INSTANT_FEE_PERCENT = 0.015;
const INSTANT_FEE_MIN_CENTS = 50;

async function getAgentSession() {
  const supabase = await createClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase not configured" }, { status: 500 }) };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "agent") {
    return { error: NextResponse.json({ error: "Agent access required" }, { status: 403 }) };
  }

  return { supabase, session, adminSupabase: createServiceRoleClient() ?? supabase };
}

export async function POST() {
  const auth = await getAgentSession();
  if ("error" in auth) return auth.error;
  const { session, adminSupabase } = auth;

  const agentId = session.user.id;
  const now = new Date();

  // Get agent's Stripe account
  const { data: agentProfile, error: profileError } = await adminSupabase
    .from("agent_profiles")
    .select("stripe_account_id, stripe_payouts_enabled")
    .eq("id", agentId)
    .single();

  if (profileError || !agentProfile) {
    return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });
  }

  if (!agentProfile.stripe_account_id) {
    return NextResponse.json({ error: "Stripe account not connected" }, { status: 400 });
  }

  if (!agentProfile.stripe_payouts_enabled) {
    return NextResponse.json({ error: "Stripe payouts not enabled" }, { status: 400 });
  }

  // Get available earnings (status='pending' and available_at <= now, or status='available')
  const { data: earnings, error: earningsError } = await adminSupabase
    .from("agent_earnings")
    .select("id, amount_cents, available_at, status")
    .eq("agent_id", agentId)
    .is("payout_id", null)
    .or(`status.eq.available,and(status.eq.pending,available_at.lte.${now.toISOString()})`);

  if (earningsError) {
    return NextResponse.json({ error: earningsError.message }, { status: 500 });
  }

  // Filter earnings that are actually available
  const availableEarnings = (earnings || []).filter((e) => {
    if (e.status === "available") return true;
    if (e.status === "pending" && new Date(e.available_at) <= now) return true;
    return false;
  });

  if (availableEarnings.length === 0) {
    return NextResponse.json({ error: "No available earnings to cash out" }, { status: 400 });
  }

  const totalAmountCents = availableEarnings.reduce((sum, e) => sum + e.amount_cents, 0);

  // Minimum $1 to cash out
  if (totalAmountCents < 100) {
    return NextResponse.json({ error: "Minimum cashout amount is $1.00" }, { status: 400 });
  }

  // Calculate fee
  const feeCents = Math.max(INSTANT_FEE_MIN_CENTS, Math.round(totalAmountCents * INSTANT_FEE_PERCENT));
  const netAmountCents = totalAmountCents - feeCents;

  if (netAmountCents <= 0) {
    return NextResponse.json({ error: "Amount too small after fees" }, { status: 400 });
  }

  // Create payout record first
  const { data: payout, error: payoutError } = await adminSupabase
    .from("agent_payouts")
    .insert({
      agent_id: agentId,
      amount_cents: totalAmountCents,
      type: "instant",
      instant_fee_cents: feeCents,
      net_amount_cents: netAmountCents,
      status: "processing",
      earnings_count: availableEarnings.length,
    })
    .select("id")
    .single();

  if (payoutError) {
    return NextResponse.json({ error: payoutError.message }, { status: 500 });
  }

  try {
    // Create Stripe Transfer to Connected Account
    const transfer = await stripe.transfers.create({
      amount: netAmountCents,
      currency: "usd",
      destination: agentProfile.stripe_account_id,
      metadata: {
        agent_id: agentId,
        payout_id: payout.id,
        type: "instant",
      },
    });

    // Update payout with transfer ID
    await adminSupabase
      .from("agent_payouts")
      .update({
        stripe_transfer_id: transfer.id,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", payout.id);

    // Mark earnings as paid out
    const earningIds = availableEarnings.map((e) => e.id);
    await adminSupabase
      .from("agent_earnings")
      .update({
        status: "paid_out",
        paid_out_at: new Date().toISOString(),
        payout_id: payout.id,
      })
      .in("id", earningIds);

    return NextResponse.json({
      ok: true,
      payout_id: payout.id,
      amount_cents: totalAmountCents,
      fee_cents: feeCents,
      net_amount_cents: netAmountCents,
      earnings_count: availableEarnings.length,
      transfer_id: transfer.id,
    });
  } catch (stripeError) {
    console.error("Stripe transfer error:", stripeError);

    // Update payout as failed
    await adminSupabase
      .from("agent_payouts")
      .update({
        status: "failed",
        failure_reason: stripeError instanceof Error ? stripeError.message : "Transfer failed",
      })
      .eq("id", payout.id);

    return NextResponse.json(
      { error: "Failed to process payout. Please try again." },
      { status: 500 }
    );
  }
}
