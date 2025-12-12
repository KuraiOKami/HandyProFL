'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

type Step = 'account' | 'personal' | 'address' | 'complete';

export default function CustomerOnboardingPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [authLoading, setAuthLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Account info
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Profile info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  // Address info
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const steps = useMemo<Step[]>(() => {
    return session ? ['personal', 'address', 'complete'] : ['account', 'personal', 'address', 'complete'];
  }, [session]);

  const currentStep = steps[stepIndex] ?? steps[0];
  const totalSteps = steps.length;

  useEffect(() => {
    if (!supabase) {
      setAuthChecked(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        // Check if user already has a profile with name filled in
        checkExistingProfile(data.session.user.id);
      } else {
        setAuthChecked(true);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        setStepIndex(0);
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const checkExistingProfile = useCallback(async (userId: string) => {
    if (!supabase) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone, street, city, state, postal_code')
      .eq('id', userId)
      .single();

    if (profile?.first_name && profile?.last_name) {
      // User has already completed onboarding, redirect to home
      router.push('/');
      return;
    }

    // Pre-fill any existing data
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setPhone(profile.phone || '');
      setStreet(profile.street || '');
      setCity(profile.city || '');
      setStateCode(profile.state || '');
      setPostalCode(profile.postal_code || '');
    }

    setAuthChecked(true);
  }, [supabase, router]);

  useEffect(() => {
    // When the step list shrinks (after auth), clamp the index to avoid out-of-range
    if (stepIndex > steps.length - 1) {
      setStepIndex(steps.length - 1);
    }
  }, [steps, stepIndex]);

  const handleAccountSubmit = async () => {
    if (session) {
      setStepIndex(0);
      return;
    }

    if (!supabase) {
      setError('Supabase is not configured. Add env vars and reload.');
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError('Enter an email and password to continue.');
      return;
    }

    if (password.trim().length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setAuthLoading(true);
    setError(null);

    try {
      const action =
        authMode === 'signup'
          ? supabase.auth.signUp({ email: email.trim(), password })
          : supabase.auth.signInWithPassword({ email: email.trim(), password });

      const { error: authError, data } = await action;

      if (authError) {
        throw authError;
      }

      if (!data.session) {
        throw new Error(
          'Check your email to confirm your account, then sign in to continue.'
        );
      }

      setSession(data.session);
      setStepIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to authenticate. Try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!session || !supabase) {
      setError('Sign in to continue.');
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }

    setSubmitLoading(true);
    setError(null);

    try {
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: session.user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        email: email.trim() || session.user.email || '',
        street: street.trim(),
        city: city.trim(),
        state: stateCode.trim().toUpperCase(),
        postal_code: postalCode.trim(),
        updated_at: new Date().toISOString(),
      });

      if (upsertError) {
        throw upsertError;
      }

      // Move to complete step
      setStepIndex(steps.findIndex((s) => s === 'complete'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleComplete = () => {
    router.push('/');
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'account':
        return Boolean(
          session || (email.trim() && password.trim() && password.trim().length >= 6)
        );
      case 'personal':
        return Boolean(firstName.trim() && lastName.trim());
      case 'address':
        return true; // Address is optional
      case 'complete':
        return true;
      default:
        return false;
    }
  };

  const goBack = () => {
    if (stepIndex === 0) {
      router.push('/');
      return;
    }
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const goNext = () => {
    if (currentStep === 'address') {
      handleSaveProfile();
    } else {
      setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const renderStep = () => {
    if (currentStep === 'account') {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Create your account</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sign up to book handyman services and track your requests.
            </p>
          </div>

          <div className="flex gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-700">
            <button
              className={`flex-1 rounded-full px-3 py-1.5 transition ${authMode === 'signup' ? 'bg-white shadow-sm ring-1 ring-slate-200' : ''}`}
              onClick={() => {
                setAuthMode('signup');
                setError(null);
              }}
            >
              Create account
            </button>
            <button
              className={`flex-1 rounded-full px-3 py-1.5 transition ${authMode === 'login' ? 'bg-white shadow-sm ring-1 ring-slate-200' : ''}`}
              onClick={() => {
                setAuthMode('login');
                setError(null);
              }}
            >
              Sign in
            </button>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-1">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="At least 6 characters"
                required
              />
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 'personal') {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Tell us about yourself</h2>
            <p className="mt-1 text-sm text-slate-500">
              We&apos;ll use this to personalize your experience and communicate about your service requests.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Jane"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Smith"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="(555) 123-4567"
            />
            <p className="mt-1 text-xs text-slate-500">For appointment reminders and updates</p>
          </div>
        </div>
      );
    }

    if (currentStep === 'address') {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Your service address</h2>
            <p className="mt-1 text-sm text-slate-500">
              Where should we send our handyman? You can always change this later.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Street Address</label>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="123 Main St"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Orlando"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">State</label>
              <input
                type="text"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="FL"
                maxLength={2}
              />
            </div>
          </div>

          <div className="sm:w-1/2">
            <label className="block text-sm font-medium text-slate-700">ZIP Code</label>
            <input
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="32801"
            />
          </div>
        </div>
      );
    }

    // Complete step
    return (
      <div className="space-y-6 text-center py-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-3xl">
          🎉
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">You&apos;re all set!</h2>
          <p className="mt-2 text-sm text-slate-500">
            Welcome to HandyProFL. You can now book handyman services and track your requests.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
          <h3 className="font-medium text-slate-900">What&apos;s next?</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-indigo-500">1.</span>
              <span>Browse our services and pick what you need</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-indigo-500">2.</span>
              <span>Choose a date and time that works for you</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-indigo-500">3.</span>
              <span>A verified handyman will arrive ready to help</span>
            </li>
          </ul>
        </div>
      </div>
    );
  };

  if (!authChecked && !session) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
            <p className="text-sm text-slate-700">Checking your account...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-xl font-bold text-white">
                H
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Welcome to HandyProFL</h1>
                <p className="text-sm text-slate-500">
                  {currentStep === 'complete' ? 'Setup complete' : `Step ${Math.min(stepIndex + 1, totalSteps - 1)} of ${totalSteps - 1}`}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {currentStep !== 'complete' && (
            <div className="mt-4 flex gap-2">
              {steps.filter(s => s !== 'complete').map((stepId, idx) => (
                <div
                  key={stepId}
                  className={`h-1.5 flex-1 rounded-full transition ${
                    idx <= stepIndex ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {renderStep()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          {currentStep === 'complete' ? (
            <>
              <div />
              <button
                onClick={handleComplete}
                className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Start Booking
              </button>
            </>
          ) : (
            <>
              <button
                onClick={goBack}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {stepIndex > 0 ? 'Back' : 'Cancel'}
              </button>

              <button
                onClick={() => (currentStep === 'account' ? handleAccountSubmit() : goNext())}
                disabled={(currentStep === 'account' ? authLoading : submitLoading) || !canProceed()}
                className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:bg-slate-300"
              >
                {currentStep === 'account'
                  ? authLoading
                    ? authMode === 'signup'
                      ? 'Creating...'
                      : 'Signing in...'
                    : authMode === 'signup'
                      ? 'Create account'
                      : 'Sign in'
                  : currentStep === 'address'
                    ? submitLoading
                      ? 'Saving...'
                      : 'Complete Setup'
                    : 'Continue'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
