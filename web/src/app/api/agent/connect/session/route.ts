import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";

type Mode = "onboarding" | "management";

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

  return { supabase, session, email: profile.email as string | null, adminSupabase: createServiceRoleClient() ?? supabase };
}

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const auth = await getAgentSession();
  if ("error" in auth) return auth.error;
  const { adminSupabase, session, email } = auth;

  const body = await req.json().catch(() => null);
  const mode: Mode = body?.mode === "management" ? "management" : "onboarding";

  // Ensure the agent has a Connect account
  const { data: agentProfile, error } = await adminSupabase
    .from("agent_profiles")
    .select("stripe_account_id")
    .eq("id", session.user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let accountId = agentProfile?.stripe_account_id as string | null;

  if (!accountId) {
    try {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: email ?? session.user.email ?? undefined,
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

      await adminSupabase
        .from("agent_profiles")
        .update({
          stripe_account_id: accountId,
          stripe_account_status: "pending",
        })
        .eq("id", session.user.id);
    } catch (stripeError) {
      console.error("Stripe account creation error:", stripeError);
      return NextResponse.json({ error: "Failed to create Stripe account" }, { status: 500 });
    }
  }

  try {
    const sessionResponse = await stripe.accountSessions.create({
      account: accountId!,
      components:
        mode === "management"
          ? { account_management: { enabled: true } }
          : { account_onboarding: { enabled: true } },
    });

    return NextResponse.json({
      client_secret: sessionResponse.client_secret,
      account_id: accountId,
      mode,
    });
  } catch (stripeError) {
    console.error("Stripe account session error:", stripeError);
    return NextResponse.json({ error: "Failed to create account session" }, { status: 500 });
  }
}
