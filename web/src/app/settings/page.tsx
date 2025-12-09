import SettingsDashboard from "@/components/SettingsDashboard";
import SettingsDashboardTabbed from "@/components/SettingsDashboardTabbed";

export default function SettingsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Account</p>
        <h1 className="text-3xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">Manage your profile, wallet, billing, and booking requests.</p>
      </div>
      {/* Mobile: stacked sections to avoid horizontal scroll; Desktop: tabbed experience */}
      <div className="md:hidden">
        <SettingsDashboard />
      </div>
      <div className="hidden md:block">
        <SettingsDashboardTabbed />
      </div>
    </div>
  );
}
