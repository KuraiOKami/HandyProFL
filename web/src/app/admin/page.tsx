import AdminDashboardTabbed from "@/components/AdminDashboardTabbed";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminRootPage() {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, email")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "admin") {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        Admin access required.
      </div>
    );
  }

  const userName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || undefined;
  const userEmail = profile.email || session.user.email || undefined;

  return (
    <AdminDashboardTabbed
      userName={userName}
      userEmail={userEmail}
    />
  );
}
