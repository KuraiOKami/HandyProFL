import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAgentSession();
  if ("error" in auth) return auth.error;
  const { session, adminSupabase } = auth;

  const { id: jobId } = await params;

  const body = await req.json().catch(() => null);
  const { type, photo_url, notes } = body ?? {};

  if (!type || !photo_url) {
    return NextResponse.json({ error: "Type and photo_url required" }, { status: 400 });
  }

  if (!["box", "finished"].includes(type)) {
    return NextResponse.json({ error: "Type must be 'box' or 'finished'" }, { status: 400 });
  }

  // Get the job assignment
  const { data: assignment, error } = await adminSupabase
    .from("job_assignments")
    .select("id, status, agent_id")
    .eq("id", jobId)
    .single();

  if (error || !assignment) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (assignment.agent_id !== session.user.id) {
    return NextResponse.json({ error: "Not your job" }, { status: 403 });
  }

  if (assignment.status === "completed") {
    return NextResponse.json({ error: "Job already completed" }, { status: 400 });
  }

  // Check if this type of photo already exists
  const { data: existingProof } = await adminSupabase
    .from("proof_of_work")
    .select("id")
    .eq("assignment_id", jobId)
    .eq("type", type)
    .single();

  if (existingProof) {
    return NextResponse.json({ error: `${type} photo already uploaded` }, { status: 400 });
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
    return NextResponse.json({ error: proofError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, proof_id: proof.id });
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
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get proofs
  const { data: proofs, error } = await adminSupabase
    .from("proof_of_work")
    .select("id, type, photo_url, notes, uploaded_at")
    .eq("assignment_id", jobId)
    .order("uploaded_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ proofs: proofs || [] });
}
