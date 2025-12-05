import SettingsDashboard from "@/components/SettingsDashboard";

export default function SettingsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Account</p>
        <h1 className="text-3xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">Profile, wallet, and your booking requests in one place.</p>
      </div>
      <SettingsDashboard />
    </div>
  );
}
