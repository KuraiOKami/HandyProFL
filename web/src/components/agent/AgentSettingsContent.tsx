'use client';

import { useEffect, useState } from 'react';
import { useThemePreference } from '@/hooks/useThemePreference';

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
  const [connectingStripe, setConnectingStripe] = useState(false);
  const { theme, setTheme } = useThemePreference();

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

  const handleConnectStripe = async () => {
    setConnectingStripe(true);
    setError(null);

    try {
      const res = await fetch('/api/agent/bank-account', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start Stripe setup');
      }

      // Redirect to Stripe onboarding
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Stripe');
      setConnectingStripe(false);
    }
  };

  const toggleSkill = (skillId: string) => {
    setSkills((prev) =>
      prev.includes(skillId) ? prev.filter((s) => s !== skillId) : [...prev, skillId]
    );
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
        <p className="text-sm text-slate-500">Connect your bank account to receive payouts</p>

        <div className="mt-4">
          {profile?.stripe_payouts_enabled ? (
            <div className="rounded-lg bg-emerald-50 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-xl">
                  ✓
                </div>
                <div>
                  <p className="font-medium text-emerald-800">Payments Enabled</p>
                  <p className="text-sm text-emerald-600">Your bank account is connected and ready to receive payouts</p>
                </div>
              </div>
            </div>
          ) : profile?.stripe_account_id ? (
            <div className="rounded-lg bg-amber-50 px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-xl">
                    ⚠️
                  </div>
                  <div>
                    <p className="font-medium text-amber-800">Setup Incomplete</p>
                    <p className="text-sm text-amber-600">Complete your Stripe account setup to receive payouts</p>
                  </div>
                </div>
                <button
                  onClick={handleConnectStripe}
                  disabled={connectingStripe}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:bg-amber-400"
                >
                  {connectingStripe ? 'Loading...' : 'Complete Setup'}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xl">
                    🏦
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">Connect Bank Account</p>
                    <p className="text-sm text-slate-600">Set up Stripe to receive your earnings</p>
                  </div>
                </div>
                <button
                  onClick={handleConnectStripe}
                  disabled={connectingStripe}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-emerald-400"
                >
                  {connectingStripe ? 'Loading...' : 'Connect Stripe'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
