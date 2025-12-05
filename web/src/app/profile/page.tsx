export default function ProfilePage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Profile</p>
        <h1 className="text-3xl font-semibold text-slate-900">Profile is now under Settings</h1>
        <p className="text-sm text-slate-600">Manage your profile, wallet, and requests from the Settings page.</p>
      </div>
      <a
        href="/settings"
        className="inline-flex items-center justify-center rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-800"
      >
        Go to Settings
      </a>
    </div>
  );
}
