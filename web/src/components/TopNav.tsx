'use client';

import Link from 'next/link';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useState } from 'react';

export default function TopNav() {
  const { session } = useSupabaseSession();
  const supabase = getSupabaseClient();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
  };

  return (
    <header className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b border-slate-200">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
          HandyProFL
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-700">
          <Link href="/services" className="hover:text-indigo-700 transition">
            Services
          </Link>
          <Link href="/schedule" className="hover:text-indigo-700 transition">
            Schedule
          </Link>
          <Link href="/requests" className="hover:text-indigo-700 transition">
            Requests
          </Link>
          <Link href="/profile" className="hover:text-indigo-700 transition">
            Profile
          </Link>
          {session ? (
            <button
              onClick={handleSignOut}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-slate-800 hover:border-indigo-600 hover:text-indigo-700 transition"
              disabled={signingOut}
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          ) : (
            <Link
              href="/auth"
              className="rounded-full bg-indigo-700 px-3 py-1.5 text-white shadow-sm hover:bg-indigo-800 transition"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
