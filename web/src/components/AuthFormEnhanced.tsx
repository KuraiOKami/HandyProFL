'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import PinInput from './auth/PinInput';

type Mode = 'login' | 'signup' | 'forgot';
type AuthMethod = 'email' | 'phone';

export default function AuthFormEnhanced() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [method, setMethod] = useState<AuthMethod>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  // Check for existing session on mount and redirect immediately
  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.push('/settings');
      } else {
        setCheckingSession(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/settings');
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

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError('Supabase is not configured. Add env vars and reload.');
      return;
    }
    if (!email) {
      setError('Enter your email address.');
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage('Password reset link sent! Check your email.');
      setTimeout(() => setMode('login'), 3000);
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
    if (otp.length !== 6) {
      setError('Please enter a 6-digit code.');
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

  // Show loading state while checking session
  if (checkingSession) {
    return (
      <div className="grid gap-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-700"></div>
            <p className="text-sm text-slate-600">Checking session...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-indigo-700">HandyProFL</p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {mode === 'forgot' ? 'Reset password' : 'Client access'}
          </h1>
          <p className="text-sm text-slate-600">
            {mode === 'forgot'
              ? 'Enter your email to receive a reset link.'
              : 'Sign in to book or manage your service requests.'}
          </p>
        </div>
        {mode !== 'forgot' && (
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
        )}
      </div>

      {mode !== 'forgot' && (
        <div className="flex gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-700">
          <button
            className={`flex-1 rounded-full px-3 py-1 transition ${method === 'email' ? 'bg-white shadow-sm ring-1 ring-slate-200' : ''}`}
            onClick={() => {
              setMethod('email');
              setMessage(null);
              setError(null);
              setCodeSent(false);
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
      )}

      {mode === 'forgot' ? (
        <form onSubmit={handleForgotPassword} className="grid gap-4">
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
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? 'Sending reset link...' : 'Send reset link'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setMessage(null);
              setError(null);
            }}
            className="text-sm text-indigo-700 hover:text-indigo-800 hover:underline"
          >
            Back to login
          </button>
        </form>
      ) : method === 'email' ? (
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
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">Password</span>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs text-indigo-700 hover:text-indigo-800 hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
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
              disabled={codeSent}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
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
              <div className="grid gap-2">
                <span className="text-sm font-medium text-slate-800 text-center">Enter 6-digit code</span>
                <PinInput value={otp} onChange={setOtp} length={6} disabled={loading} />
              </div>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? 'Verifying...' : 'Verify & sign in'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCodeSent(false);
                  setOtp('');
                  setMessage(null);
                  setError(null);
                }}
                className="text-sm text-indigo-700 hover:text-indigo-800 hover:underline"
              >
                Use different number
              </button>
            </form>
          )}
        </div>
      )}

      {message && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {!supabase && (
        <p className="text-xs text-amber-700">
          Add Supabase keys to <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">.env.local</code> to
          enable auth.
        </p>
      )}
    </div>
  );
}
