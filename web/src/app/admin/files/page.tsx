export default function AdminFilesPage() {
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Files</h1>
        <p className="text-sm text-slate-600">Photos and documents attached to requests.</p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        TODO: Connect to Supabase Storage for uploads per request.
      </div>
    </div>
  );
}
