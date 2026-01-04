'use client';

import { FormEvent, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';

export default function SecuritySettings() {
  const { session } = useSupabaseSession();
  const supabase = getSupabaseClient();
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const handlePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !session?.user) {
      setError('Sign in to update your password.');
      return;
    }
    setWorking(true);
    setError(null);
    setStatus(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
    } else {
      setStatus('Password updated. You may need to sign in again on other devices.');
      setPassword('');
    }
    setWorking(false);
  };

  const handleSignOutAll = async () => {
    if (!supabase) return;
    setSigningOutAll(true);
    setError(null);
    setStatus(null);
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
    if (signOutError) {
      setError(signOutError.message);
    } else {
      setStatus('Signed out from all sessions.');
    }
    setSigningOutAll(false);
  };

  return (
    <div className="grid gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Security</p>
          <h2 className="text-xl font-semibold text-slate-900">Password & sessions</h2>
          <p className="text-sm text-slate-600">Change password and sign out everywhere.</p>
        </div>
      </div>
      <form onSubmit={handlePassword} className="grid gap-3 md:max-w-md">
        <label className="grid gap-1 text-sm text-slate-800">
          New password
          <input
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="••••••••"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={working || !password}
            className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {working ? 'Updating...' : 'Update password'}
          </button>
          <button
            type="button"
            onClick={handleSignOutAll}
            disabled={signingOutAll}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOutAll ? 'Signing out...' : 'Sign out of all devices'}
          </button>
        </div>
      </form>
      {status && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{status}</p>}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
    </div>
  );
}
