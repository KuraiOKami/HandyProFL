'use client';

import { FormEvent, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';

type Profile = {
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
};

export default function ProfileForm() {
  const { session, loading } = useSupabaseSession();
  const supabase = getSupabaseClient();
  const [profile, setProfile] = useState<Profile>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!supabase || !session?.user) return;
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('full_name, phone, address, email')
        .eq('id', session.user.id)
        .single();
      if (fetchError && fetchError.code !== 'PGRST116') {
        setError(fetchError.message);
      } else {
        setProfile({
          full_name: data?.full_name ?? '',
          phone: data?.phone ?? '',
          address: data?.address ?? '',
          email: data?.email ?? session.user.email ?? '',
        });
      }
    };
    loadProfile();
  }, [session?.user, supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !session?.user) {
      setError('Sign in to update your profile.');
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: session.user.id,
      full_name: profile.full_name,
      phone: profile.phone,
      address: profile.address,
      email: profile.email ?? session.user.email,
      updated_at: new Date().toISOString(),
    });
    if (upsertError) {
      setError(upsertError.message);
    } else {
      setStatus('Saved. Your info will be used when booking services.');
    }
    setSaving(false);
  };

  if (!session && !loading) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        Sign in to view and edit your profile.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
        <p className="text-sm text-slate-600">Name, contact, and address used for appointments.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <label className="grid gap-1 text-sm text-slate-800">
          Full name
          <input
            type="text"
            value={profile.full_name ?? ''}
            onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="Client name"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-800">
          Phone
          <input
            type="tel"
            value={profile.phone ?? ''}
            onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="+1 555 555 5555"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-800 md:col-span-2">
          Address
          <input
            type="text"
            value={profile.address ?? ''}
            onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="Street, city, ZIP"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-800 md:col-span-2">
          Email for confirmations
          <input
            type="email"
            value={profile.email ?? ''}
            onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="you@example.com"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving || !session}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saving ? 'Saving...' : 'Save profile'}
        </button>
        <p className="text-xs text-slate-500">Syncs to Supabase table <code className="rounded bg-slate-100 px-1 py-0.5">profiles</code>.</p>
      </div>
      {status && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{status}</p>}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
    </form>
  );
}
