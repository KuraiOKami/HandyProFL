'use client';

import { FormEvent, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';

type ProfileRow = {
  first_name: string;
  middle_initial: string;
  last_name: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  postal_code: string;
  sms_consent_given: boolean;
};

const emptyProfile: ProfileRow = {
  first_name: '',
  middle_initial: '',
  last_name: '',
  phone: '',
  email: '',
  street: '',
  city: '',
  state: '',
  postal_code: '',
  sms_consent_given: false,
};

export default function ProfileForm() {
  const { session, loading } = useSupabaseSession();
  const supabase = getSupabaseClient();
  const [profile, setProfile] = useState<ProfileRow>(emptyProfile);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!supabase || !session?.user) return;
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('first_name, middle_initial, last_name, phone, email, street, city, state, postal_code, sms_consent_given')
        .eq('id', session.user.id)
        .single();
      if (fetchError && fetchError.code !== 'PGRST116') {
        setError(fetchError.message);
      } else {
        setProfile({
          first_name: data?.first_name ?? '',
          middle_initial: (data?.middle_initial ?? '').toUpperCase(),
          last_name: data?.last_name ?? '',
          phone: data?.phone ?? '',
          email: data?.email ?? session.user.email ?? '',
          street: data?.street ?? '',
          city: data?.city ?? '',
          state: (data?.state ?? '').toUpperCase(),
          postal_code: data?.postal_code ?? '',
          sms_consent_given: data?.sms_consent_given ?? false,
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

    const updateData: Record<string, unknown> = {
      id: session.user.id,
      first_name: profile.first_name,
      middle_initial: profile.middle_initial,
      last_name: profile.last_name,
      phone: profile.phone,
      email: profile.email || session.user.email || '',
      street: profile.street,
      city: profile.city,
      state: profile.state,
      postal_code: profile.postal_code,
      sms_consent_given: profile.sms_consent_given,
      updated_at: new Date().toISOString(),
    };

    // Only update sms_consent_given_at if consent is being given for the first time
    if (profile.sms_consent_given) {
      updateData.sms_consent_given_at = new Date().toISOString();
    }

    const { error: upsertError } = await supabase.from('profiles').upsert(updateData);
    if (upsertError) {
      setError(upsertError.message);
    } else {
      // Send opt-in confirmation SMS if consent was just given
      if (profile.sms_consent_given && session.user) {
        try {
          await fetch('/api/notifications/opt-in-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: session.user.id }),
          });
        } catch (err) {
          console.warn('Failed to send opt-in confirmation:', err);
        }
      }
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
          First name
          <input
            type="text"
            value={profile.first_name}
            onChange={(e) => setProfile((p) => ({ ...p, first_name: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="Jane"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-800">
          Middle initial
          <input
            type="text"
            maxLength={1}
            value={profile.middle_initial}
            onChange={(e) => setProfile((p) => ({ ...p, middle_initial: e.target.value.toUpperCase() }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="A"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-800">
          Last name
          <input
            type="text"
            value={profile.last_name}
            onChange={(e) => setProfile((p) => ({ ...p, last_name: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="Client"
          />
        </label>
        <div className="grid gap-2">
          <label className="grid gap-1 text-sm text-slate-800">
            Phone
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="+1 555 555 5555"
            />
          </label>
          {profile.phone && (
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={profile.sms_consent_given}
                onChange={(e) => setProfile((p) => ({ ...p, sms_consent_given: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-700 focus:ring-2 focus:ring-indigo-100"
              />
              <span>
                I agree to receive SMS text messages from HandyPro FL related to my account, bookings, appointment reminders,
                service updates, and payment confirmations. Message frequency varies. Message & data rates may apply.
                Reply STOP to opt out, HELP for help. See{' '}
                <a href="/sms-terms" target="_blank" className="text-indigo-700 underline hover:text-indigo-800">
                  SMS Terms
                </a>
                .
              </span>
            </label>
          )}
        </div>
        <label className="grid gap-1 text-sm text-slate-800 md:col-span-2">
          Street
          <input
            type="text"
            value={profile.street}
            onChange={(e) => setProfile((p) => ({ ...p, street: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="123 Main St"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-800">
          City
          <input
            type="text"
            value={profile.city}
            onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="Tampa"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-800">
          State
          <input
            type="text"
            value={profile.state}
            onChange={(e) => setProfile((p) => ({ ...p, state: e.target.value.toUpperCase().slice(0, 2) }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="FL"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-800">
          Postal code
          <input
            type="text"
            value={profile.postal_code}
            onChange={(e) => setProfile((p) => ({ ...p, postal_code: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="33601"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-800 md:col-span-2">
          Email for confirmations
          <input
            type="email"
            value={profile.email}
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
      </div>
      {status && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{status}</p>}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
    </form>
  );
}
