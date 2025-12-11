import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = (await createClient()) ?? createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check role
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.updates) {
    return NextResponse.json({ error: "Missing id or updates" }, { status: 400 });
  }

  const { id, updates } = body;

  // Get the request to find any linked assignment
  const { data: requestRow, error: requestError } = await supabase
    .from("service_requests")
    .select("id, assigned_agent_id")
    .eq("id", id)
    .single();

  if (requestError || !requestRow) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const { data: assignment } = await supabase
    .from("job_assignments")
    .select("id, agent_id, status, agent_payout_cents, completed_at, verified_at, paid_at, checked_out_at")
    .eq("request_id", id)
    .single();

  const { error } = await supabase.from("service_requests").update(updates).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Mirror status updates to the job assignment and earnings when applicable
  if (updates.status && assignment) {
    const now = new Date().toISOString();
    const newStatus: string = updates.status;

    const assignmentUpdate: Record<string, unknown> = {};
    let shouldCreateEarning = false;
    let earningStatus: "available" | "paid_out" = "available";

    switch (newStatus) {
      case "in_progress":
        assignmentUpdate.status = "in_progress";
        break;
      case "pending_verification":
        assignmentUpdate.status = "pending_verification";
        assignmentUpdate.checked_out_at = assignment.checked_out_at ?? now;
        break;
      case "verified":
        assignmentUpdate.status = "verified";
        assignmentUpdate.verified_at = now;
        shouldCreateEarning = true;
        earningStatus = "available";
        break;
      case "paid":
      case "completed":
      case "complete":
      case "done":
        assignmentUpdate.status = newStatus === "paid" ? "paid" : "completed";
        assignmentUpdate.paid_at = now;
        assignmentUpdate.completed_at = assignment.completed_at ?? now;
        assignmentUpdate.verified_at = assignment.verified_at ?? now;
        shouldCreateEarning = true;
        earningStatus = "paid_out";
        break;
      default:
        assignmentUpdate.status = newStatus;
        break;
    }

    // Only update if we have something to change
    if (Object.keys(assignmentUpdate).length > 0) {
      await supabase.from("job_assignments").update(assignmentUpdate).eq("id", assignment.id);
    }

    if (shouldCreateEarning) {
      const amountCents = assignment.agent_payout_cents ?? 0;
      if (amountCents > 0) {
        await supabase
          .from("agent_earnings")
          .upsert(
            {
              assignment_id: assignment.id,
              agent_id: assignment.agent_id,
              amount_cents: amountCents,
              status: earningStatus,
              available_at: now,
              paid_out_at: earningStatus === "paid_out" ? now : null,
            },
            { onConflict: "assignment_id" }
          );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
