'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function TopNav() {
  const { session } = useSupabaseSession();
  const supabase = getSupabaseClient();
  const [signingOut, setSigningOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      if (!session?.user || !supabase) {
        setRole(null);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle<{ role: string | null }>();
      if (error) {
        console.warn('Unable to fetch role', error.message);
        setRole(null);
        return;
      }
      setRole(data?.role ?? null);
    };
    fetchRole();
  }, [session, supabase]);

  const handleSignOut = async () => {
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
  };

  const isAdmin = role === 'admin';

  const NavLinks = ({ onNav }: { onNav?: () => void }) => (
    <>
      <Link href="/services" className="hover:text-indigo-700 transition" onClick={onNav}>
        Services
      </Link>
      <Link
        href="/requests"
        className="rounded-full bg-indigo-700 px-3 py-1.5 text-white shadow-sm shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-800"
        onClick={onNav}
      >
        Book a request
      </Link>
      <Link href="/settings" className="hover:text-indigo-700 transition" onClick={onNav}>
        Settings
      </Link>
      {session?.user && isAdmin && (
        <Link href="/admin" className="hover:text-indigo-700 transition" onClick={onNav}>
          Admin
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b border-slate-200">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
          HandyProFL
        </Link>
        <div className="flex items-center gap-3 sm:hidden">
          {session ? (
            <button
              onClick={handleSignOut}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700 transition"
              disabled={signingOut}
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          ) : (
            <Link
              href="/auth"
              className="rounded-full bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-800 transition"
            >
              Sign in
            </Link>
          )}
          <button
            onClick={() => setMobileOpen((prev) => !prev)}
            className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:border-indigo-600 hover:text-indigo-700"
            aria-label="Toggle navigation"
          >
            ☰
          </button>
        </div>
        <nav className="hidden items-center gap-4 text-sm font-medium text-slate-700 sm:flex">
          <NavLinks />
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
      {mobileOpen && (
        <div className="sm:hidden border-t border-slate-200 bg-white/95 px-4 pb-4 shadow-inner">
          <div className="grid gap-3 py-3 text-sm font-semibold text-slate-800">
            <NavLinks onNav={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
}
