import ClientDashboardLayout from "@/components/client/ClientDashboardLayout";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function ClientDashboardPage() {
  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">Supabase not configured.</p>
        </div>
      </div>
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth?redirect=/dashboard");
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, phone")
    .eq("id", session.user.id)
    .single();

  const userName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || undefined;
  const userEmail = profile?.email || session.user.email || undefined;

  return (
    <ClientDashboardLayout
      userName={userName}
      userEmail={userEmail}
    />
  );
}
