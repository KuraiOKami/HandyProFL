'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { getSupabaseClient } from '@/lib/supabaseClient';

type Preferences = {
  email_updates: boolean;
  sms_updates: boolean;
  marketing: boolean;
};

const defaultPrefs: Preferences = {
  email_updates: true,
  sms_updates: true,
  marketing: false,
};

export default function NotificationSettings() {
  const { session } = useSupabaseSession();
  const supabase = getSupabaseClient();
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user?.id ?? null;
  const canFetch = useMemo(() => Boolean(userId && supabase), [userId, supabase]);

  useEffect(() => {
    const load = async () => {
      if (!canFetch) return;
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('notification_preferences')
        .select('email_updates, sms_updates, marketing')
        .eq('user_id', userId)
        .single();
      if (fetchError && fetchError.code !== 'PGRST116') {
        setError(fetchError.message);
      } else if (data) {
        setPrefs({
          email_updates: data.email_updates ?? true,
          sms_updates: data.sms_updates ?? true,
          marketing: data.marketing ?? false,
        });
      }
      setLoading(false);
    };
    load();
  }, [canFetch, supabase, userId]);

  const save = async () => {
    if (!supabase || !userId) {
      setError('Sign in to update preferences.');
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    const { error: upsertError } = await supabase.from('notification_preferences').upsert({
      user_id: userId,
      email_updates: prefs.email_updates,
      sms_updates: prefs.sms_updates,
      marketing: prefs.marketing,
      updated_at: new Date().toISOString(),
    });
    if (upsertError) {
      setError(upsertError.message);
    } else {
      setStatus('Notification preferences saved.');
    }
    setSaving(false);
  };

  return (
    <div className="grid gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Notifications</p>
          <h2 className="text-xl font-semibold text-slate-900">Email & SMS</h2>
          <p className="text-sm text-slate-600">Choose how we contact you about bookings.</p>
        </div>
        <button
          onClick={save}
          disabled={saving || !session}
          className="rounded-lg bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saving ? 'Saving...' : 'Save preferences'}
        </button>
      </div>
      {!session && <p className="text-sm text-amber-700">Sign in to manage notifications.</p>}
      {loading && <p className="text-sm text-slate-600">Loading preferences...</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <Toggle
          label="Email updates"
          description="Booking confirmations, schedule changes, and reminders."
          checked={prefs.email_updates}
          onChange={(checked) => setPrefs((p) => ({ ...p, email_updates: checked }))}
          disabled={!session}
        />
        <Toggle
          label="SMS updates"
          description="Text reminders and day-of updates."
          checked={prefs.sms_updates}
          onChange={(checked) => setPrefs((p) => ({ ...p, sms_updates: checked }))}
          disabled={!session}
        />
        <Toggle
          label="Marketing"
          description="Occasional promos and tips."
          checked={prefs.marketing}
          onChange={(checked) => setPrefs((p) => ({ ...p, marketing: checked }))}
          disabled={!session}
        />
      </div>
      {status && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{status}</p>}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
    </div>
  );
}

type ToggleProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

function Toggle({ label, description, checked, onChange, disabled }: ToggleProps) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-600"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="grid gap-0.5">
        <span className="text-sm font-semibold text-slate-900">{label}</span>
        <span className="text-xs text-slate-600">{description}</span>
      </span>
    </label>
  );
}
