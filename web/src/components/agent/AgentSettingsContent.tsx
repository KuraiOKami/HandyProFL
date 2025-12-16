'use client';

import { useEffect, useRef, useState } from 'react';
import { useThemePreference } from '@/hooks/useThemePreference';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import WalletSettings from '@/components/WalletSettings';

type AgentProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  bio: string;
  photo_url: string | null;
  skills: string[];
  service_area_miles: number;
  status: string;
  stripe_account_id: string | null;
  stripe_account_status: string;
  stripe_payouts_enabled: boolean;
};

const SKILL_OPTIONS = [
  { id: 'assembly', label: 'Furniture Assembly' },
  { id: 'tv_mount', label: 'TV Mounting' },
  { id: 'electrical', label: 'Electrical & Lighting' },
  { id: 'smart_home', label: 'Smart Home' },
  { id: 'plumbing', label: 'Plumbing' },
  { id: 'doors_hardware', label: 'Doors & Hardware' },
  { id: 'repairs', label: 'Repairs & Patching' },
  { id: 'exterior', label: 'Exterior Work' },
  { id: 'tech', label: 'Tech & Networking' },
];

export default function AgentSettingsContent() {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payoutStatus, setPayoutStatus] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [activeComponent, setActiveComponent] = useState<'onboarding' | 'management' | null>(null);
  const { theme, setTheme } = useThemePreference();
  const mountedComponentRef = useRef<(HTMLElement & { unmount?: () => void }) | null>(null);
  const embedContainerRef = useRef<HTMLDivElement | null>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [serviceArea, setServiceArea] = useState(25);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    loadPayoutStatus();
    return () => {
      // Cleanup embedded component when unmounting
      if (mountedComponentRef.current?.unmount) {
        mountedComponentRef.current.unmount();
      }
    };
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agent/profile');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load profile');
      }

      const p = data.profile;
      setProfile(p);
      setFirstName(p.first_name || '');
      setLastName(p.last_name || '');
      setPhone(p.phone || '');
      setBio(p.bio || '');
      setSkills(p.skills || []);
      setServiceArea(p.service_area_miles || 25);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/agent/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone,
          bio,
          skills,
          service_area_miles: serviceArea,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save profile');
      }

      setSuccess('Profile updated successfully');
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const toggleSkill = (skillId: string) => {
    setSkills((prev) =>
      prev.includes(skillId) ? prev.filter((s) => s !== skillId) : [...prev, skillId]
    );
  };

  const loadPayoutStatus = async () => {
    setPayoutLoading(true);
    setPayoutError(null);
    try {
      const res = await fetch('/api/agent/bank-account');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load payout status');
      }
      const statusLabel = data.payouts_enabled
        ? 'Payouts enabled'
        : data.status === 'pending'
          ? 'Pending verification'
          : 'Not connected';
      setPayoutStatus(statusLabel);
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Failed to load payout status');
    } finally {
      setPayoutLoading(false);
    }
  };

  const startEmbeddedConnect = async (mode: 'onboarding' | 'management') => {
    setPayoutError(null);
    setPayoutLoading(true);

    try {
      if (!embedContainerRef.current) {
        throw new Error('Payout setup container not ready');
      }

      const res = await fetch('/api/agent/connect/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });

      const data = await res.json();
      if (!res.ok || !data.client_secret) {
        throw new Error(data.error || 'Unable to start payout setup');
      }

      if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
        throw new Error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
      }

      // Tear down any existing component
      if (mountedComponentRef.current?.unmount) {
        mountedComponentRef.current.unmount();
      } else if (mountedComponentRef.current && embedContainerRef.current) {
        embedContainerRef.current.removeChild(mountedComponentRef.current);
      }
      mountedComponentRef.current = null;

      const clientSecret = data.client_secret as string;
      const connectInstance = loadConnectAndInitialize({
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        fetchClientSecret: async () => clientSecret,
        appearance: {
          variables: { colorPrimary: '#0f766e' },
        },
      });

      const component = connectInstance.create(
        mode === 'management' ? 'account-management' : 'account-onboarding'
      );

      if (embedContainerRef.current) {
        embedContainerRef.current.appendChild(component);
      }
      mountedComponentRef.current = component;
      setActiveComponent(mode);
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Unable to load payout setup');
    } finally {
      setPayoutLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!profile) return null;

    switch (profile.status) {
      case 'approved':
        return <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">Approved</span>;
      case 'pending_approval':
        return <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">Pending Approval</span>;
      case 'suspended':
        return <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-700">Suspended</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700"></div>
          <p className="text-sm text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Appearance */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Appearance</h3>
            <p className="text-sm text-slate-500">Switch between light and dark mode</p>
          </div>
          <div className="flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-700">
            {(['light', 'dark', 'system'] as const).map((value) => (
              <button
                key={value}
                className={`rounded-full px-3 py-1 transition ${
                  theme === value ? 'bg-white shadow-sm ring-1 ring-slate-200' : ''
                }`}
                onClick={() => setTheme(value)}
              >
                {value === 'system' ? 'System' : value === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Account Status */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Account Status</h3>
            <p className="text-sm text-slate-500">Your agent account status</p>
          </div>
          {getStatusBadge()}
        </div>

        {profile?.status === 'pending_approval' && (
          <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Your account is pending approval. You&apos;ll be able to accept gigs once approved.
          </div>
        )}
      </div>

      {/* Profile Info */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Profile Information</h3>
        <p className="text-sm text-slate-500">Update your personal details</p>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
            />
            <p className="mt-1 text-xs text-slate-500">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell customers about yourself and your experience..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Skills */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Skills & Services</h3>
        <p className="text-sm text-slate-500">Select the services you can provide</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SKILL_OPTIONS.map((skill) => (
            <button
              key={skill.id}
              type="button"
              onClick={() => toggleSkill(skill.id)}
              className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
                skills.includes(skill.id)
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {skills.includes(skill.id) ? '✓ ' : ''}{skill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Service Area */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Service Area</h3>
        <p className="text-sm text-slate-500">How far are you willing to travel for jobs?</p>

        <div className="mt-4">
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

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-emerald-400"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Payment Setup */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Payment Setup</h3>
        <p className="text-sm text-slate-500">
          Add or update the bank/card we use for payouts and instant cash out. Managed securely with Stripe embedded components.
        </p>
        <div className="mt-4 grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {payoutLoading ? 'Checking payout status...' : payoutStatus || 'Payout status unknown'}
              </p>
              {payoutError && <p className="text-sm text-rose-600">{payoutError}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => startEmbeddedConnect('onboarding')}
                disabled={payoutLoading}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
              >
                {activeComponent === 'onboarding' && payoutLoading ? 'Loading...' : 'Start onboarding'}
              </button>
              <button
                onClick={() => startEmbeddedConnect('management')}
                disabled={payoutLoading}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-emerald-500 disabled:bg-slate-200"
              >
                {activeComponent === 'management' && payoutLoading ? 'Loading...' : 'Manage payouts'}
              </button>
              <button
                onClick={loadPayoutStatus}
                disabled={payoutLoading}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:bg-slate-200"
              >
                Refresh status
              </button>
            </div>
          </div>

          <div
            ref={embedContainerRef}
            className="min-h-[400px] rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4"
          >
            {!activeComponent && (
              <p className="text-sm text-slate-500">
                Launch onboarding or management to load the embedded payout setup here.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Job payment methods</h4>
            <p className="text-sm text-slate-600">
              Cards you store for job charges and instant confirmations live in your wallet.
            </p>
            <div className="mt-3">
              <WalletSettings />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
