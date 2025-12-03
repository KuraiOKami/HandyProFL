import ProfileForm from "@/components/ProfileForm";

export default function ProfilePage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Client profile</p>
        <h1 className="text-3xl font-semibold text-slate-900">Contact & address</h1>
        <p className="text-sm text-slate-600">
          Save your preferred contact info and service address. Used for reminders and billing.
        </p>
      </div>
      <ProfileForm />
    </div>
  );
}
