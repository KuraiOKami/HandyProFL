import AdminRequestsTable from "@/components/AdminRequestsTable";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminRequestsPage() {
  const supabase = await createClient();
  if (!supabase) {
    return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm">Supabase not configured.</div>;
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

  const { data: requests = [] } = await supabase
    .from("service_requests")
    .select("id, user_id, service_type, preferred_date, preferred_time, details, status, estimated_minutes, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Requests</h1>
        <p className="text-sm text-slate-600">View and manage all client requests.</p>
      </div>
      <AdminRequestsTable initial={requests} />
    </div>
  );
}
