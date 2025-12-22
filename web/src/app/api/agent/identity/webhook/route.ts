import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecret
  ? new Stripe(stripeSecret)
  : null;

const mapIdentityStatus = (
  status: Stripe.Identity.VerificationSession.Status | null | undefined
) => {
  if (status === "verified") return "verified";
  if (status === "canceled") return "canceled";
  return "pending";
};

export async function POST(req: NextRequest) {
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe Identity not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe Identity webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Only handle Identity verification events
  if (!event.type.startsWith("identity.verification_session")) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Identity.VerificationSession;
  const userId = session.metadata?.user_id || session.metadata?.userId;

  if (!userId) {
    console.warn("Stripe Identity session missing user_id metadata", { sessionId: session.id });
    return NextResponse.json({ received: true });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    console.error("Supabase service role not configured for webhook processing");
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const newStatus = mapIdentityStatus(session.status);

  const updates: {
    id: string;
    identity_verification_status: string;
    stripe_identity_session_id: string;
    identity_verified_at?: string;
    identity_verification_notes?: string;
  } = {
    id: userId,
    identity_verification_status: newStatus,
    stripe_identity_session_id: session.id,
  };

  if (newStatus === "verified") {
    updates.identity_verified_at = new Date().toISOString();
  }

  const noteParts: string[] = [];
  if (session.last_error?.code) noteParts.push(session.last_error.code);
  if (session.last_error?.reason) noteParts.push(session.last_error.reason);
  if (noteParts.length > 0) {
    updates.identity_verification_notes = noteParts.join(": ");
  }

  try {
    await supabase.from("agent_profiles").upsert(updates, { onConflict: "id" });
  } catch (err) {
    console.error("Failed to persist identity verification status:", err);
    return NextResponse.json({ error: "Failed to update agent profile" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
