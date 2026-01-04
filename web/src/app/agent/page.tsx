import AgentDashboardLayout from "@/components/agent/AgentDashboardLayout";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AgentRootPage() {
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
    redirect("/auth?redirect=/agent");
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, email")
    .eq("id", session.user.id)
    .single();

  // Check if user is an agent
  if (profile?.role !== "agent") {
    // If not an agent, check if they want to become one
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-center">
            <div className="mb-4 text-5xl">🛠️</div>
            <h1 className="text-2xl font-bold text-slate-900">Become an Agent</h1>
            <p className="mt-2 text-slate-600">
              Want to earn money by completing handyman jobs in your area?
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <Link
              href="/agent/onboarding"
              className="block w-full rounded-lg bg-emerald-600 px-4 py-3 text-center font-semibold text-white transition hover:bg-emerald-700"
            >
              Apply to Become an Agent
            </Link>
            <Link
              href="/"
              className="block w-full rounded-lg border border-slate-200 px-4 py-3 text-center font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Back to Home
            </Link>
          </div>

          <div className="mt-6 rounded-lg bg-slate-50 p-4">
            <h3 className="font-medium text-slate-900">Why become an agent?</h3>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                Set your own schedule
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                Earn 70% of every job
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                Weekly payouts or instant cashout
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                Choose jobs in your area
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Get agent profile
  const { data: agentProfile } = await supabase
    .from("agent_profiles")
    .select("status, stripe_account_id, stripe_payouts_enabled")
    .eq("id", session.user.id)
    .single();

  const userName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || undefined;
  const userEmail = profile.email || session.user.email || undefined;

  return (
    <AgentDashboardLayout
      userName={userName}
      userEmail={userEmail}
      agentStatus={agentProfile?.status || "pending_approval"}
      stripeConnected={true}
    />
  );
}
