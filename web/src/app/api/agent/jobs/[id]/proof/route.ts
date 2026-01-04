import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { errorResponse } from "@/lib/api-errors";
import * as Sentry from "@sentry/nextjs";

async function getAgentSession() {
  const supabase = await createClient();
  if (!supabase) {
    return { error: errorResponse("service.unconfigured", "Supabase not configured", 500) };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: errorResponse("auth.missing", "Unauthorized", 401) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "agent") {
    return { error: errorResponse("auth.not_agent", "Agent access required", 403) };
  }

  return { supabase, session, adminSupabase: createServiceRoleClient() ?? supabase };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return Sentry.startSpan({ op: "proof.upload", name: "Agent uploads proof" }, async (span) => {
    const auth = await getAgentSession();
    if ("error" in auth) return auth.error;
    const { session, adminSupabase } = auth;

    const { id: jobId } = await params;
    span.setAttribute("job_id", jobId);
    span.setAttribute("agent_id", session.user.id);

    const body = await req.json().catch(() => null);
    const { type, photo_url, notes } = body ?? {};

    if (!type || !photo_url) {
      return errorResponse("request.invalid", "Type and photo_url required", 400);
    }

    if (!["box", "finished"].includes(type)) {
      return errorResponse("request.invalid", "Type must be 'box' or 'finished'", 400);
    }

    // Get the job assignment
    const { data: assignment, error } = await adminSupabase
      .from("job_assignments")
      .select("id, status, agent_id")
      .eq("id", jobId)
      .single();

    if (error || !assignment) {
      return errorResponse("job.not_found", "Job not found", 404);
    }

    if (assignment.agent_id !== session.user.id) {
      return errorResponse("job.not_assigned", "Not your job", 403);
    }

    if (assignment.status === "completed") {
      return errorResponse("job.invalid_status", "Job already completed", 400);
    }

    // Check if this type of photo already exists
    const { data: existingProof } = await adminSupabase
      .from("proof_of_work")
      .select("id")
      .eq("assignment_id", jobId)
      .eq("type", type)
      .single();

    if (existingProof) {
      return errorResponse("proof.duplicate", `${type} photo already uploaded`, 400);
    }

    // Create proof record
    const { data: proof, error: proofError } = await adminSupabase
      .from("proof_of_work")
      .insert({
        assignment_id: jobId,
        agent_id: session.user.id,
        type,
        photo_url,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (proofError) {
      return errorResponse("internal.error", proofError.message, 500);
    }

    span.setAttribute("proof_id", proof?.id || "");
    span.setAttribute("proof_type", type);

    return NextResponse.json({ ok: true, proof_id: proof.id });
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAgentSession();
  if ("error" in auth) return auth.error;
  const { session, adminSupabase } = auth;

  const { id: jobId } = await params;

  // Verify the agent owns this job
  const { data: assignment } = await adminSupabase
    .from("job_assignments")
    .select("id")
    .eq("id", jobId)
    .eq("agent_id", session.user.id)
    .single();

  if (!assignment) {
    return errorResponse("job.not_found", "Job not found", 404);
  }

  // Get proofs
  const { data: proofs, error } = await adminSupabase
    .from("proof_of_work")
    .select("id, type, photo_url, notes, uploaded_at")
    .eq("assignment_id", jobId)
    .order("uploaded_at", { ascending: true });

  if (error) {
    return errorResponse("internal.error", error.message, 500);
  }

  return NextResponse.json({ proofs: proofs || [] });
}
