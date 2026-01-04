import AuthFormEnhanced from "@/components/AuthFormEnhanced";

export default function AuthPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Secure client access</p>
        <h1 className="text-3xl font-semibold text-slate-900">Login or create an account</h1>
        <p className="text-sm text-slate-600">Email + password or phone number with a one-time code.</p>
      </div>
      <AuthFormEnhanced />
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-600">
        After signing in, manage your profile, submit service requests, and pick calendar slots. Supabase handles auth and
        email/SMS delivery.
      </div>
    </div>
  );
}
