import Link from "next/link";
import { redirect } from "next/navigation";

import AdminRequestDetailView, {
  ClientProfile,
  RequestDetail,
  RelatedRequest,
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

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
          <h1 className="text-3xl font-semibold text-slate-900">Request details</h1>
          <p className="text-sm text-slate-600">Full request view with client info and scheduling context.</p>
        </div>
        <Link
          href="/admin"
          className="text-sm font-semibold text-indigo-700 hover:text-indigo-800 hover:underline"
        >
          ← Back to admin
        </Link>
      </div>

      <AdminRequestDetailView
        request={request as RequestDetail}
        client={clientProfile}
        otherRequests={otherRequests}
      />
    </div>
  );
}
