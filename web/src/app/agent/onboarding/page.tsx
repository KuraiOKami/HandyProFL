'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { US_STATES } from '@/lib/usStates';

const SKILL_OPTIONS = [
  { id: 'assembly', label: 'Furniture Assembly', icon: '🪑' },
  { id: 'tv_mount', label: 'TV Mounting', icon: '📺' },
  { id: 'electrical', label: 'Electrical & Lighting', icon: '💡' },
  { id: 'smart_home', label: 'Smart Home', icon: '🏠' },
  { id: 'plumbing', label: 'Plumbing', icon: '🔧' },
  { id: 'doors_hardware', label: 'Doors & Hardware', icon: '🚪' },
  { id: 'repairs', label: 'Repairs & Patching', icon: '🔨' },
  { id: 'exterior', label: 'Exterior Work', icon: '🏡' },
  { id: 'tech', label: 'Tech & Networking', icon: '📡' },
];

type Step = 'account' | 'personal' | 'skills' | 'review';

export default function AgentOnboardingPage() {
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
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [serviceArea, setServiceArea] = useState(25);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const steps = useMemo<Step[]>(() => {
    return session ? ['personal', 'skills', 'review'] : ['account', 'personal', 'skills', 'review'];
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
        setStepIndex(0); // skip the account step
      }
      setAuthChecked(true);
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
  }, [supabase]);

  useEffect(() => {
    // When the step list shrinks (after auth), clamp the index to avoid out-of-range
    if (stepIndex > steps.length - 1) {
      setStepIndex(steps.length - 1);
    }
  }, [steps, stepIndex]);

  const toggleSkill = (skillId: string) => {
    setSkills((prev) =>
      prev.includes(skillId) ? prev.filter((s) => s !== skillId) : [...prev, skillId]
    );
  };

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
      const redirectUrl = `${window.location.origin}/auth/callback`;
      const action =
        authMode === 'signup'
          ? supabase.auth.signUp({
              email: email.trim(),
              password,
              options: { emailRedirectTo: redirectUrl },
            })
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

  const handleSubmit = async () => {
    if (!session) {
      setError('Create an account or sign in before submitting your application.');
      setStepIndex(0);
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      setStepIndex(steps.findIndex((s) => s === 'personal'));
      return;
    }

    if (!phone.trim()) {
      setError('A phone number is required for dispatch updates.');
      setStepIndex(steps.findIndex((s) => s === 'personal'));
      return;
    }

    if (skills.length === 0) {
      setError('Select at least one skill to continue.');
      setStepIndex(steps.findIndex((s) => s === 'skills'));
      return;
    }

    if (!agreeToTerms) {
      setError('Please agree to the terms to continue.');
      setStepIndex(steps.findIndex((s) => s === 'review'));
      return;
    }

    setSubmitLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agent/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone,
          street,
          city,
          state: stateCode,
          postal_code: postalCode,
          bio,
          skills,
          service_area_miles: serviceArea,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register');
      }

      router.push('/agent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register');
    } finally {
      setSubmitLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'account':
        return Boolean(
          session || (email.trim() && password.trim() && password.trim().length >= 6)
        );
      case 'personal':
        return Boolean(firstName.trim() && lastName.trim() && phone.trim());
      case 'skills':
        return skills.length > 0;
      case 'review':
        return agreeToTerms;
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
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const renderStep = () => {
    if (currentStep === 'account') {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Create or sign in</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use your email and password to create a HandyProFL account. We&apos;ll use it for payouts and dispatch updates.
            </p>
          </div>

          <div className="flex gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-700">
            <button
              className={`flex-1 rounded-full px-3 py-1 transition ${authMode === 'signup' ? 'bg-white shadow-sm ring-1 ring-slate-200' : ''}`}
              onClick={() => {
                setAuthMode('signup');
                setError(null);
              }}
            >
              Create account
            </button>
            <button
              className={`flex-1 rounded-full px-3 py-1 transition ${authMode === 'login' ? 'bg-white shadow-sm ring-1 ring-slate-200' : ''}`}
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="At least 6 characters"
                required
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p>
              Already using SMS login? You can also sign in at <span className="font-medium text-slate-800">/auth</span> and then return here to finish your application.
            </p>
          </div>
        </div>
      );
    }

    if (currentStep === 'personal') {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Contact & background</h2>
            <p className="mt-1 text-sm text-slate-500">Tell us how to reach you for jobs and payouts.</p>
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="John"
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Smith"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Phone <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Street</label>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="123 Main St"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Orlando"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">State</label>
              <select
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Select state</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Postal Code</label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="32801"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Bio / experience</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Tell us about your trade, certifications, and tools."
              />
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 'skills') {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Skills & service area</h2>
            <p className="mt-1 text-sm text-slate-500">Select the services you can provide.</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {SKILL_OPTIONS.map((skill) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => toggleSkill(skill.id)}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
                  skills.includes(skill.id)
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-xl">{skill.icon}</span>
                <span className="text-sm font-medium">{skill.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700">
              Service Radius: {serviceArea} miles
            </label>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={serviceArea}
              onChange={(e) => setServiceArea(parseInt(e.target.value))}
              className="mt-2 w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              <span>5 miles</span>
              <span>50 miles</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Review & submit</h2>
          <p className="mt-1 text-sm text-slate-500">Double-check your details before sending.</p>
        </div>

        <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Contact</p>
              <p className="text-sm text-slate-600">
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Name not provided'}
              </p>
              <p className="text-sm text-slate-600">{email || 'Email from your account'}</p>
              <p className="text-sm text-slate-600">{phone || 'Phone not provided'}</p>
            </div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Profile</div>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <p className="text-sm font-semibold text-slate-900">Location</p>
            <p className="text-sm text-slate-600">
              {[street, city, stateCode, postalCode].filter(Boolean).join(', ') || 'Not provided'}
            </p>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <p className="text-sm font-semibold text-slate-900">Skills</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {skills.length === 0 ? (
                <span className="text-sm text-slate-500">No skills selected</span>
              ) : (
                skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                  >
                    {SKILL_OPTIONS.find((s) => s.id === skill)?.icon}
                    {SKILL_OPTIONS.find((s) => s.id === skill)?.label || skill}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <p className="text-sm font-semibold text-slate-900">Service radius</p>
            <p className="text-sm text-slate-600">{serviceArea} miles</p>
          </div>

          {bio && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-sm font-semibold text-slate-900">Bio</p>
              <p className="text-sm text-slate-600">{bio}</p>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-medium text-slate-900">Payout & workflow</h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-500">•</span>
              <span>Applications are reviewed by the HandyProFL team.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-500">•</span>
              <span>Earn 70% of every job. Weekly payouts with instant cash-out for approved agents.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-500">•</span>
              <span>Submit proof-of-work photos for each job to get paid.</span>
            </li>
          </ul>
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
          <input
            type="checkbox"
            checked={agreeToTerms}
            onChange={(e) => setAgreeToTerms(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm text-slate-700">
            I agree to the Agent Terms of Service and understand my application must be approved before I can accept jobs.
          </span>
        </label>
      </div>
    );
  };

  if (!authChecked && !session) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
            <p className="text-sm text-slate-700">Checking your account...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-slate-50 p-4">
      <div className="mx-auto my-4 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl sm:my-8">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-xl font-bold text-white">
                H
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Become an Agent</h1>
                <p className="text-sm text-slate-500">
                  Step {Math.min(stepIndex + 1, totalSteps)} of {totalSteps}
                </p>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              {session ? 'Signed in' : 'Create your account to start'}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 flex gap-2">
            {steps.map((stepId, idx) => (
              <div
                key={stepId}
                className={`h-1.5 flex-1 rounded-full transition ${
                  idx <= stepIndex ? 'bg-emerald-600' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
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
          <button
            onClick={goBack}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {stepIndex > 0 ? 'Back' : 'Cancel'}
          </button>

          {currentStep === 'review' ? (
            <button
              onClick={handleSubmit}
              disabled={submitLoading || !canProceed()}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
            >
              {submitLoading ? 'Submitting...' : 'Submit Application'}
            </button>
          ) : (
            <button
              onClick={() => (currentStep === 'account' ? handleAccountSubmit() : goNext())}
              disabled={(currentStep === 'account' ? authLoading : false) || !canProceed()}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
            >
              {currentStep === 'account'
                ? authLoading
                  ? authMode === 'signup'
                    ? 'Creating...'
                    : 'Signing in...'
                  : authMode === 'signup'
                    ? 'Create account & continue'
                    : 'Sign in & continue'
                : 'Continue'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
