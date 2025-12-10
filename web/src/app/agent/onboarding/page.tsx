'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

export default function AgentOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [serviceArea, setServiceArea] = useState(25);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const toggleSkill = (skillId: string) => {
    setSkills((prev) =>
      prev.includes(skillId) ? prev.filter((s) => s !== skillId) : [...prev, skillId]
    );
  };

  const handleSubmit = async () => {
    if (!agreeToTerms) {
      setError('Please agree to the terms to continue');
      return;
    }

    if (skills.length === 0) {
      setError('Please select at least one skill');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agent/register', {
        method: 'POST',
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
        throw new Error(data.error || 'Failed to register');
      }

      // Success - redirect to agent portal
      router.push('/agent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return firstName.trim() && lastName.trim();
      case 2:
        return skills.length > 0;
      case 3:
        return agreeToTerms;
      default:
        return false;
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-xl font-bold text-white">
              H
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Become an Agent</h1>
              <p className="text-sm text-slate-500">Step {step} of 3</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition ${
                  s <= step ? 'bg-emerald-600' : 'bg-slate-200'
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

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Personal Information</h2>
                <p className="mt-1 text-sm text-slate-500">Tell us about yourself</p>
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

              <div>
                <label className="block text-sm font-medium text-slate-700">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Tell customers about your experience and skills..."
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Skills & Service Area</h2>
                <p className="mt-1 text-sm text-slate-500">Select the services you can provide</p>
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
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Almost Done!</h2>
                <p className="mt-1 text-sm text-slate-500">Review and agree to our terms</p>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="font-medium text-slate-900">How it works:</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-emerald-500">1.</span>
                    <span>Your application will be reviewed by our team</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-emerald-500">2.</span>
                    <span>Once approved, you can browse and accept available gigs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-emerald-500">3.</span>
                    <span>Complete jobs and submit proof of work (before/after photos)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-emerald-500">4.</span>
                    <span>Earn 70% of each job - weekly payouts or instant cashout</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="font-medium text-slate-900">Payout Structure:</h3>
                <div className="mt-2 space-y-1 text-sm">
                  <p className="text-slate-600">
                    <span className="font-semibold text-emerald-600">70%</span> of job price goes to you
                  </p>
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-900">30%</span> platform fee
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">
                  I agree to the Agent Terms of Service and understand that my application will be reviewed before I can start accepting jobs.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : router.push('/')}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {step > 1 ? 'Back' : 'Cancel'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || !canProceed()}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
