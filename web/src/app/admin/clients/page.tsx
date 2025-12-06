import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminClientsPage() {
  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
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

  const adminSupabase = createServiceRoleClient() ?? supabase;

  const { data, error } = await adminSupabase
    .from("profiles")
    .select(
      `
        id,
        first_name,
        middle_initial,
        last_name,
        email,
        phone,
        street,
        city,
        state,
        postal_code,
        role
      `
    )
    .order("updated_at", { ascending: false });

  const clients = data ?? [];

  const { data: reqCounts = [] } = await adminSupabase
    .from("service_requests")
    .select("user_id, count:id")
    .group("user_id");

  const { data: addrCounts = [] } = await adminSupabase
    .from("addresses")
    .select("user_id, count:id")
    .group("user_id");

  const requestMap = new Map<string, number>();
  reqCounts.forEach((r: any) => requestMap.set(r.user_id, r.count));
  const addressMap = new Map<string, number>();
  addrCounts.forEach((a: any) => addressMap.set(a.user_id, a.count));

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Clients</h1>
        <p className="text-sm text-slate-600">CRM-style list of clients and their history.</p>
      </div>
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error.message}</p>}
      <div className="grid gap-3">
        {clients.map((c: any) => (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {[c.first_name, c.middle_initial, c.last_name].filter(Boolean).join(" ") || "Unknown"}
                </p>
                <p className="text-sm text-slate-600">
                  {c.email || "No email"} • {c.phone || "No phone"}
                </p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                {c.role || "client"}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              {[c.street, c.city, c.state, c.postal_code].filter(Boolean).join(", ") || "No address on file"}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
                Requests: {requestMap.get(c.id) ?? 0}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
                Addresses: {addressMap.get(c.id) ?? 0}
              </span>
            </div>
          </div>
        ))}
        {!clients.length && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
            No clients found.
          </div>
        )}
      </div>
    </div>
  );
}
