import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";

async function getAdminSession() {
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

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }

  return { supabase, session, adminSupabase: createServiceRoleClient() ?? supabase };
}

// POST /api/admin/jobs/[id]/verify - Verify a completed job
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAdminSession();
  if ("error" in auth) return auth.error;
  const { session, adminSupabase } = auth;

  const { id: jobId } = await params;
  const body = await req.json().catch(() => ({}));
  const { action, notes } = body as { action?: string; notes?: string };

  // Get the job assignment
  const { data: assignment, error } = await adminSupabase
    .from("job_assignments")
    .select("id, status, agent_id, agent_payout_cents, request_id")
    .eq("id", jobId)
    .single();

  if (error || !assignment) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Handle different actions
  switch (action) {
    case "approve":
    case "verify": {
      // Can only approve jobs that are pending_verification
      if (assignment.status !== "pending_verification") {
        return NextResponse.json(
          { error: "Job must be pending verification" },
          { status: 400 }
        );
      }

      const now = new Date();
      const completedAt = now.toISOString();
      // Earnings available in 2 hours
      const availableAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

      const payoutCents =
        assignment.agent_payout_cents ??
        (assignment.job_price_cents ? Math.round(assignment.job_price_cents * 0.7) : 0);

      // Update job to completed in one step
      const { error: updateError } = await adminSupabase
        .from("job_assignments")
        .update({
          status: "completed",
          verified_at: completedAt,
          verified_by: session.user.id,
          verification_notes: notes || null,
          agent_payout_cents: payoutCents,
          paid_at: completedAt,
          completed_at: completedAt,
        })
        .eq("id", jobId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Create earnings record for the agent
      const { error: earningsError } = await adminSupabase
        .from("agent_earnings")
        .insert({
          agent_id: assignment.agent_id,
          assignment_id: jobId,
          amount_cents: payoutCents,
          status: "pending",
          available_at: availableAt,
        });

      if (earningsError) {
        console.error("Failed to create earnings record:", earningsError);
      }

      // Update service request to complete
      if (assignment.request_id) {
        await adminSupabase
          .from("service_requests")
          .update({ status: "complete" })
          .eq("id", assignment.request_id);
      }

      // Update agent profile stats
      try {
        await adminSupabase.rpc("increment_agent_stats", {
          p_agent_id: assignment.agent_id,
          p_amount_cents: assignment.agent_payout_cents,
        });
      } catch (err) {
        console.warn("increment_agent_stats RPC missing or failed", err);
      }

      return NextResponse.json({
        ok: true,
        status: "completed",
        completed_at: completedAt,
        earnings_available_at: availableAt,
      });
    }

    case "pay": {
      // Legacy - redirect to approve flow
      return NextResponse.json(
        { error: "Use 'approve' action instead" },
        { status: 400 }
      );
    }

    case "complete": {
      // Legacy - redirect to approve flow
      return NextResponse.json(
        { error: "Use 'approve' action instead" },
        { status: 400 }
      );
    }

    case "reject": {
      // Can reject jobs that are pending_verification
      if (assignment.status !== "pending_verification") {
        return NextResponse.json(
          { error: "Can only reject jobs pending verification" },
          { status: 400 }
        );
      }

      // Move back to in_progress so agent can redo work
      const { error: updateError } = await adminSupabase
        .from("job_assignments")
        .update({
          status: "in_progress",
          rejection_notes: notes || "Work rejected - please redo",
          rejected_at: new Date().toISOString(),
          rejected_by: session.user.id,
        })
        .eq("id", jobId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Delete the checkout record so agent can check out again
      await adminSupabase
        .from("agent_checkins")
        .delete()
        .eq("assignment_id", jobId)
        .eq("type", "checkout");

      return NextResponse.json({ ok: true, status: "in_progress", message: "Job sent back to agent" });
    }

    default:
      return NextResponse.json(
        { error: "Invalid action. Use: verify, pay, complete, or reject" },
        { status: 400 }
      );
  }
}

// GET /api/admin/jobs/[id]/verify - Get job verification details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAdminSession();
  if ("error" in auth) return auth.error;
  const { adminSupabase } = auth;

  const { id: jobId } = await params;

  // Get full job details
  const { data: assignment, error } = await adminSupabase
    .from("job_assignments")
    .select(`
      id,
      request_id,
      agent_id,
      status,
      agent_payout_cents,
      job_price_cents,
      platform_fee_cents,
      assigned_at,
      started_at,
      checked_out_at,
      verified_at,
      verified_by,
      verification_notes,
      paid_at,
      completed_at,
      rejection_notes,
      rejected_at,
      service_requests (
        id,
        service_type,
        preferred_date,
        preferred_time,
        estimated_minutes,
        details,
        user_id,
        profiles:user_id (
          first_name,
          last_name,
          phone,
          email,
          street,
          city,
          state,
          postal_code
        )
      )
    `)
    .eq("id", jobId)
    .single();

  if (error || !assignment) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get agent info
  const { data: agent } = await adminSupabase
    .from("profiles")
    .select("first_name, last_name, email, phone")
    .eq("id", assignment.agent_id)
    .single();

  // Get checkins
  const { data: checkins } = await adminSupabase
    .from("agent_checkins")
    .select("type, created_at, latitude, longitude, location_verified")
    .eq("assignment_id", jobId)
    .order("created_at", { ascending: true });

  // Get proof photos
  const { data: proofs } = await adminSupabase
    .from("proof_of_work")
    .select("id, type, photo_url, notes, uploaded_at")
    .eq("assignment_id", jobId)
    .order("uploaded_at", { ascending: true });

  return NextResponse.json({
    job: assignment,
    agent: agent ? {
      name: `${agent.first_name || ""} ${agent.last_name || ""}`.trim() || "Agent",
      email: agent.email,
      phone: agent.phone,
    } : null,
    checkins: checkins || [],
    proofs: proofs || [],
  });
}
