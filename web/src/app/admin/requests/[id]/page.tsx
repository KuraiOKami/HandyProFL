import Link from "next/link";
import { redirect } from "next/navigation";

import AdminRequestDetailView, {
  ClientProfile,
  RequestDetail,
  RelatedRequest,
  JobAssignment,
  AgentCheckin,
  ProofOfWork,
} from "@/components/admin/AdminRequestDetailView";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";

type PageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function AdminRequestDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm">
        Supabase not configured.
      </div>
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();

  if (profile?.role !== "admin") {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        Admin access required.
      </div>
    );
  }

  const adminSupabase = createServiceRoleClient() ?? supabase;

  const {
    data: request,
    error: requestError,
  } = await adminSupabase
    .from("service_requests")
    .select(
      "id, user_id, service_type, preferred_date, preferred_time, details, status, estimated_minutes, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (requestError && requestError.code !== "PGRST116") {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
        Failed to load request: {requestError.message}
      </div>
    );
  }

  if (!request) {
    return (
      <div className="grid gap-4">
        <Link href="/admin" className="text-sm font-semibold text-indigo-700 hover:text-indigo-800">
          ← Back to admin
        </Link>
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
          Request not found.
        </div>
      </div>
    );
  }

  let clientProfile: ClientProfile | null = null;
  if (request.user_id) {
    const { data } = await adminSupabase
      .from("profiles")
      .select(
        "first_name, middle_initial, last_name, email, phone, street, city, state, postal_code",
      )
      .eq("id", request.user_id)
      .maybeSingle();
    clientProfile = data ?? null;
  }

  let otherRequests: RelatedRequest[] = [];
  if (request.user_id) {
    const { data } = await adminSupabase
      .from("service_requests")
      .select("id, service_type, status, preferred_date, preferred_time, created_at")
      .eq("user_id", request.user_id)
      .neq("id", request.id)
      .order("created_at", { ascending: false })
      .limit(5);
    otherRequests = data ?? [];
  }

  // Fetch job assignment data if exists
  let jobAssignment: JobAssignment | null = null;
  let agentProfile: { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null = null;
  let checkins: AgentCheckin[] = [];
  let proofs: ProofOfWork[] = [];

  const { data: jobData } = await adminSupabase
    .from("job_assignments")
    .select("id, agent_id, status, job_price_cents, agent_payout_cents, platform_fee_cents, assigned_at, started_at, checked_out_at, verified_at, paid_at, completed_at, verification_notes, rejection_notes")
    .eq("request_id", id)
    .maybeSingle();

  if (jobData) {
    jobAssignment = jobData;

    // Fetch agent profile
    if (jobData.agent_id) {
      const { data: agent } = await adminSupabase
        .from("profiles")
        .select("first_name, last_name, email, phone")
        .eq("id", jobData.agent_id)
        .maybeSingle();
      agentProfile = agent;
    }

    // Fetch check-ins
    const { data: checkinData } = await adminSupabase
      .from("agent_checkins")
      .select("id, type, created_at, latitude, longitude, location_verified")
      .eq("job_id", jobData.id)
      .order("created_at", { ascending: true });
    checkins = checkinData ?? [];

    // Fetch proof of work photos
    const { data: proofData } = await adminSupabase
      .from("proof_of_work")
      .select("id, type, photo_url, notes, uploaded_at")
      .eq("job_id", jobData.id)
      .order("uploaded_at", { ascending: true });
    proofs = proofData ?? [];
  }

  return (
    <AdminRequestDetailView
      request={request as RequestDetail}
      client={clientProfile}
      otherRequests={otherRequests}
      jobAssignment={jobAssignment}
      agentProfile={agentProfile}
      checkins={checkins}
      proofs={proofs}
    />
  );
}
