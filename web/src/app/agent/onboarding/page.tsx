'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { US_STATES } from '@/lib/usStates';
import PinInput from '@/components/auth/PinInput';

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

type Step = 'account' | 'personal' | 'verification' | 'skills' | 'review';

export default function AgentOnboardingPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('phone'); // Default to phone for simpler flow
  const [authLoading, setAuthLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Account info - Email
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Account info - Phone OTP
  const [authPhone, setAuthPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

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

  // Selfie upload state (kept for profile photo)
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // Identity verification state
  const [identityStatus, setIdentityStatus] = useState<'not_started' | 'pending' | 'verified' | 'canceled'>('not_started');
  const [identityLoading, setIdentityLoading] = useState(false);

  const steps = useMemo<Step[]>(() => {
    return session ? ['personal', 'verification', 'skills', 'review'] : ['account', 'personal', 'verification', 'skills', 'review'];
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

  // Pre-fill profile data for logged-in users
  const loadExistingProfile = useCallback(async () => {
    if (!supabase || !session || profileLoaded) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, street, city, state, postal_code')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        if (profile.first_name) setFirstName(profile.first_name);
        if (profile.last_name) setLastName(profile.last_name);
        if (profile.phone) setPhone(profile.phone);
        if (profile.street) setStreet(profile.street);
        if (profile.city) setCity(profile.city);
        if (profile.state) setStateCode(profile.state);
        if (profile.postal_code) setPostalCode(profile.postal_code);
      }

      // Also check if they have an existing agent profile
      const { data: agentProfile } = await supabase
        .from('agent_profiles')
        .select('bio, selfie_url, service_area_miles')
        .eq('id', session.user.id)
        .single();

      if (agentProfile) {
        if (agentProfile.bio) setBio(agentProfile.bio);
        if (agentProfile.selfie_url) {
          setSelfieUrl(agentProfile.selfie_url);
          setSelfiePreview(agentProfile.selfie_url);
        }
        if (agentProfile.service_area_miles) setServiceArea(agentProfile.service_area_miles);
      }

      setProfileLoaded(true);
    } catch (err) {
      console.error('Failed to load existing profile:', err);
      setProfileLoaded(true);
    }
  }, [supabase, session, profileLoaded]);

  useEffect(() => {
    if (session) {
      loadExistingProfile();
    }
  }, [session, loadExistingProfile]);

  // Format phone number for display
  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  // Send OTP to phone
  const handleSendOtp = async () => {
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }

    const digits = authPhone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    setAuthLoading(true);
    setError(null);

    try {
      const fullPhone = `+1${digits}`;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });

      if (otpError) {
        throw otpError;
      }

      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }

    if (otp.length !== 6) {
      setError('Please enter the 6-digit code.');
      return;
    }

    setAuthLoading(true);
    setError(null);

    try {
      const digits = authPhone.replace(/\D/g, '');
      const fullPhone = `+1${digits}`;
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: otp,
        type: 'sms',
      });

      if (verifyError) {
        throw verifyError;
      }

      if (data.session) {
        setSession(data.session);
        // Pre-fill phone in profile since they authenticated with it
        setPhone(formatPhoneNumber(digits));
        setStepIndex(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code.');
    } finally {
      setAuthLoading(false);
    }
  };

  const toggleSkill = (skillId: string) => {
    setSkills((prev) =>
      prev.includes(skillId) ? prev.filter((s) => s !== skillId) : [...prev, skillId]
    );
  };

  // Check verification status on mount and when returning from Stripe
  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (!session) return;

      try {
        const res = await fetch('/api/agent/identity/create-session');
        const data = await res.json();
        if (data.status) {
          setIdentityStatus(data.status);
        }
      } catch (err) {
        console.error('Failed to check verification status:', err);
      }
    };

    checkVerificationStatus();

    // Check if returning from Stripe verification
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verification') === 'complete') {
      checkVerificationStatus();
      // Clean up URL
      window.history.replaceState({}, '', '/agent/onboarding');
    }
  }, [session]);

  const startIdentityVerification = async () => {
    if (!session) {
      setError('Please sign in first to verify your identity.');
      return;
    }

    setIdentityLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agent/identity/create-session', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start verification');
      }

      // Redirect to Stripe Identity verification
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start verification');
    } finally {
      setIdentityLoading(false);
    }
  };

  const handleSelfieUpload = async (file: File) => {
    if (!supabase || !session) {
      setError('Please sign in first to upload your photo.');
      return;
    }

    setUploadingSelfie(true);
    setError(null);

    try {
      // Create a preview
      const previewUrl = URL.createObjectURL(file);
      setSelfiePreview(previewUrl);

      // Upload to Supabase Storage
      const fileName = `agent-selfies/${session.user.id}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('agent-verification')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('agent-verification')
        .getPublicUrl(fileName);

      setSelfieUrl(urlData.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo');
      setSelfiePreview(null);
    } finally {
      setUploadingSelfie(false);
    }
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
          selfie_url: selfieUrl,
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
        if (session) return true;
        if (authMethod === 'phone') {
          if (otpSent) return otp.length === 6;
          return authPhone.replace(/\D/g, '').length === 10;
        }
        return Boolean(email.trim() && password.trim() && password.trim().length >= 6);
      case 'personal':
        return Boolean(firstName.trim() && lastName.trim() && phone.trim());
      case 'verification':
        return identityStatus === 'verified'; // ID verification required
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
            <h2 className="text-xl font-semibold text-slate-900">Get started</h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter your phone number to create an account or sign in. No password needed.
            </p>
          </div>

          {/* Auth Method Toggle */}
          <div className="flex gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-700">
            <button
              className={`flex-1 rounded-full px-3 py-1.5 transition ${authMethod === 'phone' ? 'bg-white shadow-sm ring-1 ring-slate-200' : ''}`}
              onClick={() => {
                setAuthMethod('phone');
                setError(null);
                setOtpSent(false);
                setOtp('');
              }}
            >
              Phone (Recommended)
            </button>
            <button
              className={`flex-1 rounded-full px-3 py-1.5 transition ${authMethod === 'email' ? 'bg-white shadow-sm ring-1 ring-slate-200' : ''}`}
              onClick={() => {
                setAuthMethod('email');
                setError(null);
              }}
            >
              Email
            </button>
          </div>

          {authMethod === 'phone' ? (
            <div className="space-y-4">
              {!otpSent ? (
                <div className="grid gap-1">
                  <label className="text-sm font-medium text-slate-700">Phone Number</label>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                      +1
                    </span>
                    <input
                      type="tel"
                      value={authPhone}
                      onChange={(e) => setAuthPhone(formatPhoneNumber(e.target.value))}
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="(555) 123-4567"
                      maxLength={14}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    We&apos;ll send you a 6-digit code to verify your number.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
                    <p className="text-sm font-medium text-emerald-800">
                      Code sent to {authPhone}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtp('');
                      }}
                      className="mt-1 text-xs text-emerald-600 hover:text-emerald-700"
                    >
                      Change number
                    </button>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-slate-700 text-center">
                      Enter verification code
                    </label>
                    <PinInput value={otp} onChange={setOtp} length={6} disabled={authLoading} />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={authLoading}
                    className="w-full text-center text-sm text-slate-600 hover:text-slate-800"
                  >
                    Didn&apos;t receive code? Resend
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Email/Password Mode Toggle */}
              <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-700">
                <button
                  className={`flex-1 rounded-md px-3 py-1 transition ${authMode === 'signup' ? 'bg-white shadow-sm' : ''}`}
                  onClick={() => {
                    setAuthMode('signup');
                    setError(null);
                  }}
                >
                  Create account
                </button>
                <button
                  className={`flex-1 rounded-md px-3 py-1 transition ${authMode === 'login' ? 'bg-white shadow-sm' : ''}`}
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

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                <p>
                  Note: Email signup requires email verification. For instant access, use phone number instead.
                </p>
              </div>
            </>
          )}
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

    if (currentStep === 'verification') {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Identity Verification</h2>
            <p className="mt-1 text-sm text-slate-500">
              We need to verify your identity to ensure safety for everyone. This only takes a few minutes.
            </p>
          </div>

          {/* What you'll need - Document Checklist */}
          {identityStatus !== 'verified' && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">What you&apos;ll need:</h3>
              <div className="mt-3 grid gap-3">
                <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-xl">
                    🪪
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Front of ID</p>
                    <p className="text-xs text-slate-500">Driver&apos;s license, passport, or state ID</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-xl">
                    🔄
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Back of ID</p>
                    <p className="text-xs text-slate-500">We&apos;ll verify the barcode and info</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-xl">
                    📸
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Live Selfie</p>
                    <p className="text-xs text-slate-500">Quick photo to match with your ID</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ID Verification Section */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
            {identityStatus === 'verified' ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">
                  ✅
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-emerald-700">Identity Verified</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Your identity has been successfully verified. You can continue to the next step.
                  </p>
                </div>
              </div>
            ) : identityStatus === 'pending' ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
                  ⏳
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-amber-700">Verification In Progress</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Your verification is being processed. This usually takes a few minutes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startIdentityVerification}
                  disabled={identityLoading}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Check again or restart
                </button>
              </div>
            ) : identityStatus === 'canceled' ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-4xl">
                  ❌
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-rose-700">Verification Incomplete</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Your previous verification was not completed. Please try again.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startIdentityVerification}
                  disabled={identityLoading}
                  className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {identityLoading ? 'Starting...' : 'Try Again'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-4xl">
                  🔐
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-900">Ready to Verify</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Click below to securely verify your identity. Takes about 2 minutes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startIdentityVerification}
                  disabled={identityLoading}
                  className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {identityLoading ? 'Starting verification...' : 'Start Secure Verification'}
                </button>
                <p className="text-xs text-slate-500">
                  Powered by Stripe Identity - your data is encrypted and secure
                </p>
              </div>
            )}
          </div>

          {/* Profile Photo Section (optional, still nice to have) */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Profile Photo (Optional)</h3>
            <p className="mt-1 text-xs text-slate-500">Add a friendly photo clients will see when you&apos;re assigned to their job.</p>
            <div className="mt-3 flex items-center gap-4">
              <input
                ref={selfieInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleSelfieUpload(file);
                }}
              />
              {selfiePreview ? (
                <>
                  <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-emerald-500">
                    <Image
                      src={selfiePreview}
                      alt="Your photo"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => selfieInputRef.current?.click()}
                    disabled={uploadingSelfie}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                  >
                    Change photo
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => selfieInputRef.current?.click()}
                  disabled={uploadingSelfie}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {uploadingSelfie ? 'Uploading...' : 'Add Photo'}
                </button>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="text-sm font-semibold text-emerald-800">Why we verify identity</h3>
            <ul className="mt-2 space-y-1 text-sm text-emerald-700">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-emerald-500">✓</span>
                <span>Clients trust verified agents in their homes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-emerald-500">✓</span>
                <span>Protects you from identity fraud</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-emerald-500">✓</span>
                <span>Verified agents get more job opportunities</span>
              </li>
            </ul>
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

          <div className="border-t border-slate-200 pt-3">
            <p className="text-sm font-semibold text-slate-900">Verification Photo</p>
            {selfiePreview ? (
              <div className="mt-2 flex items-center gap-3">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-emerald-500">
                  <Image
                    src={selfiePreview}
                    alt="Your selfie"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <span className="text-sm text-emerald-600">Photo uploaded</span>
              </div>
            ) : (
              <p className="mt-1 text-sm text-rose-600">No photo uploaded</p>
            )}
          </div>
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
              onClick={() => {
                if (currentStep === 'account') {
                  if (authMethod === 'phone') {
                    if (otpSent) {
                      handleVerifyOtp();
                    } else {
                      handleSendOtp();
                    }
                  } else {
                    handleAccountSubmit();
                  }
                } else {
                  goNext();
                }
              }}
              disabled={(currentStep === 'account' ? authLoading : false) || !canProceed()}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
            >
              {currentStep === 'account'
                ? authLoading
                  ? authMethod === 'phone'
                    ? otpSent
                      ? 'Verifying...'
                      : 'Sending code...'
                    : authMode === 'signup'
                      ? 'Creating...'
                      : 'Signing in...'
                  : authMethod === 'phone'
                    ? otpSent
                      ? 'Verify & Continue'
                      : 'Send Code'
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
