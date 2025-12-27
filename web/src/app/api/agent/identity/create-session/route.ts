import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSupabase = createServiceRoleClient() ?? supabase;

  // Check if agent profile exists
  const { data: agentProfile } = await adminSupabase
    .from("agent_profiles")
    .select("id, identity_verification_status, stripe_identity_session_id")
    .eq("id", session.user.id)
    .single();

  // If already verified, don't create a new session
  if (agentProfile?.identity_verification_status === "verified") {
    return NextResponse.json({
      error: "Identity already verified",
      status: "verified"
    }, { status: 400 });
  }

  // Get profile info for pre-filling
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", session.user.id)
    .single();

  try {
    // Create Stripe Identity Verification Session
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: {
        user_id: session.user.id,
      },
      options: {
        document: {
          allowed_types: ["driving_license", "passport", "id_card"],
          require_id_number: false,
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
      // Pre-fill with known info
      ...(profile?.email && {
        provided_details: {
          email: profile.email,
        },
      }),
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin")}/agent/onboarding?verification=complete`,
    });

    // Store the session ID in agent_profiles (create if doesn't exist)
    if (agentProfile) {
      await adminSupabase
        .from("agent_profiles")
        .update({
          stripe_identity_session_id: verificationSession.id,
          identity_verification_status: "pending",
        })
        .eq("id", session.user.id);
    } else {
      // Create a temporary agent profile entry to track verification
      await adminSupabase
        .from("agent_profiles")
        .upsert({
          id: session.user.id,
          stripe_identity_session_id: verificationSession.id,
          identity_verification_status: "pending",
          status: "pending_verification",
        }, { onConflict: "id" });
    }

    return NextResponse.json({
      client_secret: verificationSession.client_secret,
      session_id: verificationSession.id,
      url: verificationSession.url,
    });
  } catch (error) {
    console.error("Stripe Identity error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create verification session" },
      { status: 500 }
    );
  }
}

// GET: Check current verification status
export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSupabase = createServiceRoleClient() ?? supabase;

  const { data: agentProfile } = await adminSupabase
    .from("agent_profiles")
    .select("identity_verification_status, stripe_identity_session_id")
    .eq("id", session.user.id)
    .single();

  if (!agentProfile) {
    return NextResponse.json({ status: "not_started" });
  }

  // If we have a session ID and status is pending, check with Stripe
  if (agentProfile.stripe_identity_session_id && agentProfile.identity_verification_status === "pending") {
    try {
      const verificationSession = await stripe.identity.verificationSessions.retrieve(
        agentProfile.stripe_identity_session_id
      );

      // Update status if changed
      if (verificationSession.status !== "requires_input") {
        const newStatus = verificationSession.status === "verified" ? "verified" :
                         verificationSession.status === "canceled" ? "canceled" : "pending";

        await adminSupabase
          .from("agent_profiles")
          .update({ identity_verification_status: newStatus })
          .eq("id", session.user.id);

        return NextResponse.json({
          status: newStatus,
          stripe_status: verificationSession.status,
        });
      }
    } catch (error) {
      console.error("Error checking verification status:", error);
    }
  }

  return NextResponse.json({
    status: agentProfile.identity_verification_status || "not_started"
  });
}
