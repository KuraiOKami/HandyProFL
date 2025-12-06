import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminDashboardPage() {
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

  const adminSupabase = createServiceRoleClient() ?? supabase;

  const today = new Date();
  const todayISODate = today.toISOString().slice(0, 10);
  const startOfWeek = new Date();
  startOfWeek.setDate(today.getDate() - 6);
  const startOfWeekISO = startOfWeek.toISOString();

  const [{ count: pendingCount, error: pendingError }, { count: todaysCount, error: todayError }, { count: newClientsCount, error: newClientsError }] =
    await Promise.all([
      adminSupabase.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      adminSupabase.from("service_requests").select("id", { count: "exact", head: true }).eq("preferred_date", todayISODate),
      adminSupabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("updated_at", startOfWeekISO)
        .lte("updated_at", today.toISOString()),
    ]);

  const cards = [
    { title: "Pending requests", value: pendingError ? "—" : pendingCount ?? 0 },
    { title: "Today’s appointments", value: todayError ? "—" : todaysCount ?? 0 },
    { title: "New clients this week", value: newClientsError ? "—" : newClientsCount ?? 0 },
  ];

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">Snapshot of requests, clients, and schedule.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">{card.title}</p>
            <p className="text-2xl font-semibold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>
      {(pendingError || todayError || newClientsError) && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Some stats failed to load. Ensure the SUPABASE_SERVICE_ROLE_KEY is set for admin dashboard queries.
        </p>
      )}
    </div>
  );
}
