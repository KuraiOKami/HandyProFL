import AdminServicesTable from "@/components/AdminServicesTable";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminServicesPage() {
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
  if (!session) redirect("/auth");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
  if (profile?.role !== "admin") {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        Admin access required.
      </div>
    );
  }

  const adminClient = createServiceRoleClient() ?? supabase;
  const { data, error } = await adminClient
    .from("service_catalog")
    .select("id, name, base_minutes, price_cents")
    .order("name", { ascending: true });

  const services = data ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Services</h1>
        <p className="text-sm text-slate-600">Manage catalog, pricing, and estimated durations.</p>
      </div>
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error.message}</p>}
      <AdminServicesTable initial={services} />
    </div>
  );
}
