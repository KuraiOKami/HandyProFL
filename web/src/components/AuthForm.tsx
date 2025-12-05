'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

type Mode = 'login' | 'signup';
type AuthMethod = 'email' | 'phone';

export default function AuthForm() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [method, setMethod] = useState<AuthMethod>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  // Redirect to profile once a session exists
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push('/profile');
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/profile');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError('Supabase is not configured. Add env vars and reload.');
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);

    const action =
      mode === 'login'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { error: authError } = await action;
    if (authError) {
      setError(authError.message);
    } else {
      setMessage(mode === 'login' ? 'Signed in. Redirecting...' : 'Account created. Check your email to confirm.');
    }
    setLoading(false);
  };

  const sendOtp = async () => {
    if (!supabase) {
      setError('Supabase is not configured. Add env vars and reload.');
      return;
    }
    if (!phone) {
      setError('Enter a phone number.');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error: authError } = await supabase.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: true },
    });
    if (authError) {
      setError(authError.message);
    } else {
      setCodeSent(true);
      setMessage('Code sent. Enter the 6-digit code you received.');
    }
    setLoading(false);
  };

  const verifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError('Supabase is not configured. Add env vars and reload.');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error: authError } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });
    if (authError) {
      setError(authError.message);
    } else {
      setMessage('Signed in with your phone number.');
    }
    setLoading(false);
  };

  return (
    <div className="grid gap-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-indigo-700">HandyProFL</p>
          <h1 className="text-2xl font-semibold text-slate-900">Client access</h1>
          <p className="text-sm text-slate-600">Sign in to book or manage your service requests.</p>
        </div>
        <div className="flex gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-700">
          <button
            className={`rounded-full px-3 py-1 transition ${mode === 'login' ? 'bg-white shadow-sm ring-1 ring-slate-200' : ''}`}
            onClick={() => {
              setMode('login');
              setMessage(null);
              setError(null);
            }}
          >
            Login
          </button>
          <button
            className={`rounded-full px-3 py-1 transition ${mode === 'signup' ? 'bg-white shadow-sm ring-1 ring-slate-200' : ''}`}
            onClick={() => {
              setMode('signup');
              setMessage(null);
              setError(null);
            }}
          >
            Sign up
          </button>
        </div>
      </div>

      <div className="flex gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-700">
        <button
          className={`flex-1 rounded-full px-3 py-1 transition ${method === 'email' ? 'bg-white shadow-sm ring-1 ring-slate-200' : ''}`}
          onClick={() => {
            setMethod('email');
            setMessage(null);
            setError(null);
          }}
        >
          Email & password
        </button>
        <button
          className={`flex-1 rounded-full px-3 py-1 transition ${method === 'phone' ? 'bg-white shadow-sm ring-1 ring-slate-200' : ''}`}
          onClick={() => {
            setMethod('phone');
            setMessage(null);
            setError(null);
          }}
        >
          Phone + code
        </button>
      </div>

      {method === 'email' ? (
        <form onSubmit={handleEmailSubmit} className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-slate-800">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="you@example.com"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-slate-800">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="••••••••"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? 'Working...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-1">
            <span className="text-sm font-medium text-slate-800">Phone number</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 555 5555"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          {!codeSent ? (
            <button
              onClick={sendOtp}
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? 'Sending code...' : 'Send login code'}
            </button>
          ) : (
            <form onSubmit={verifyOtp} className="grid gap-3">
              <div className="grid gap-1">
                <span className="text-sm font-medium text-slate-800">6-digit code</span>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? 'Verifying...' : 'Verify & sign in'}
              </button>
            </form>
          )}
        </div>
      )}

      {message && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {!supabase && (
        <p className="text-xs text-amber-700">
          Add Supabase keys to <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">.env.local</code> to enable auth.
        </p>
      )}
    </div>
  );
}
