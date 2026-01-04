import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import AgentProfileContent from "@/components/admin/AgentProfileContent";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminAgentProfilePage({ params }: Props) {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "admin") {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        Admin access required.
      </div>
    );
  }

  return <AgentProfileContent agentId={id} />;
}
