import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { stripe } from "@/lib/stripe";

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
    .select("role, email")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "agent") {
    return { error: NextResponse.json({ error: "Agent access required" }, { status: 403 }) };
  }

  return { supabase, session, email: profile.email };
}

// GET: Get Stripe account status
export async function GET() {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const auth = await getAgentSession();
  if ("error" in auth) return auth.error;
  const { supabase, session } = auth;

  const adminSupabase = createServiceRoleClient() ?? supabase;

  const { data: agentProfile, error } = await adminSupabase
    .from("agent_profiles")
    .select("stripe_account_id, stripe_account_status, stripe_payouts_enabled, stripe_charges_enabled")
    .eq("id", session.user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!agentProfile?.stripe_account_id) {
    return NextResponse.json({
      connected: false,
      status: "not_connected",
    });
  }

  // Get fresh status from Stripe
  try {
    const account = await stripe.accounts.retrieve(agentProfile.stripe_account_id);

    const payoutsEnabled = account.payouts_enabled ?? false;
    const chargesEnabled = account.charges_enabled ?? false;
    const detailsSubmitted = account.details_submitted ?? false;

    // Update our database with fresh status
    await adminSupabase
      .from("agent_profiles")
      .update({
        stripe_payouts_enabled: payoutsEnabled,
        stripe_charges_enabled: chargesEnabled,
        stripe_account_status: detailsSubmitted ? (payoutsEnabled ? "enabled" : "restricted") : "pending",
      })
      .eq("id", session.user.id);

    return NextResponse.json({
      connected: true,
      status: detailsSubmitted ? (payoutsEnabled ? "enabled" : "restricted") : "pending",
      payouts_enabled: payoutsEnabled,
      charges_enabled: chargesEnabled,
      details_submitted: detailsSubmitted,
    });
  } catch (stripeError) {
    console.error("Stripe account check error:", stripeError);
    return NextResponse.json({
      connected: true,
      status: agentProfile.stripe_account_status || "unknown",
      payouts_enabled: agentProfile.stripe_payouts_enabled,
      charges_enabled: agentProfile.stripe_charges_enabled,
    });
  }
}

// POST: Create or get Stripe Connect onboarding link
export async function POST() {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const auth = await getAgentSession();
  if ("error" in auth) return auth.error;
  const { supabase, session, email } = auth;

  const adminSupabase = createServiceRoleClient() ?? supabase;

  const { data: agentProfile, error } = await adminSupabase
    .from("agent_profiles")
    .select("stripe_account_id")
    .eq("id", session.user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let accountId = agentProfile?.stripe_account_id;

  // Create new Stripe Express account if needed
  if (!accountId) {
    try {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: email || session.user.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: {
          user_id: session.user.id,
        },
      });

      accountId = account.id;

      // Save to database
      await adminSupabase
        .from("agent_profiles")
        .update({
          stripe_account_id: accountId,
          stripe_account_status: "pending",
        })
        .eq("id", session.user.id);
    } catch (stripeError) {
      console.error("Stripe account creation error:", stripeError);
      return NextResponse.json(
        { error: "Failed to create Stripe account" },
        { status: 500 }
      );
    }
  }

  // Create account link for onboarding
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/agent?tab=settings`,
      return_url: `${baseUrl}/agent?tab=settings&stripe=success`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (stripeError) {
    console.error("Stripe account link error:", stripeError);
    return NextResponse.json(
      { error: "Failed to create onboarding link" },
      { status: 500 }
    );
  }
}
