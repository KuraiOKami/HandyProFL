'use client';

import { useEffect, useMemo, useState } from 'react';
import { useThemePreference } from '@/hooks/useThemePreference';

type CompanySettings = {
  name: string;
  supportEmail: string;
  supportPhone: string;
  timezone: string;
  serviceArea: string;
};

type Profile = {
  id: string;
  first_name: string | null;
  middle_initial: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
};

type IntegrationStatus = {
  supabaseUrl: boolean;
  supabaseAnonKey: boolean;
  supabaseServiceRoleKey: boolean;
  stripeSecretKey: boolean;
  stripeWebhookSecret: boolean;
  twilioAuthToken: boolean;
  resendApiKey: boolean;
  netlifySiteId: boolean;
};

const LOCAL_STORAGE_KEY = 'hp-admin-company-settings';

const defaultCompanySettings: CompanySettings = {
  name: 'HandyProFL',
  supportEmail: 'support@handyprofl.com',
  supportPhone: '+1 (555) 555-1212',
  timezone: 'America/New_York',
  serviceArea: 'Tampa Bay Area',
};

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
        ok
          ? 'bg-green-50 text-green-800 ring-1 ring-green-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30'
          : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-green-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'}`} />
      {label}
    </span>
  );
}

export default function AdminSettingsContent() {
  const [company, setCompany] = useState<CompanySettings>(defaultCompanySettings);
  const [companyMessage, setCompanyMessage] = useState<string | null>(null);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roleSavingId, setRoleSavingId] = useState<string | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const { theme, setTheme } = useThemePreference();

  // Load persisted company settings locally (browser only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        setCompany({ ...defaultCompanySettings, ...JSON.parse(stored) });
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Fetch roles
  useEffect(() => {
    const loadRoles = async () => {
      setRolesLoading(true);
      setRolesError(null);
      try {
        const res = await fetch('/api/admin/settings/roles');
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setRolesError(body.error || 'Failed to load admins');
          setRolesLoading(false);
          return;
        }
        const data = await res.json();
        setProfiles(data.profiles ?? []);
      } catch {
        setRolesError('Failed to load admins');
      } finally {
        setRolesLoading(false);
      }
    };
    loadRoles();
  }, []);

  // Fetch integration status
  useEffect(() => {
    const loadIntegrationStatus = async () => {
      setIntegrationError(null);
      try {
        const res = await fetch('/api/admin/settings/integrations');
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setIntegrationError(body.error || 'Failed to load integration status');
          return;
        }
        const data = await res.json();
        setIntegrationStatus(data);
      } catch {
        setIntegrationError('Failed to load integration status');
      }
    };
    loadIntegrationStatus();
  }, []);

  const admins = useMemo(() => profiles.filter((p) => p.role === 'admin'), [profiles]);
  const team = useMemo(() => profiles.filter((p) => p.role !== 'admin'), [profiles]);

  const saveCompanySettings = () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(company));
    setCompanyMessage('Settings saved.');
    setTimeout(() => setCompanyMessage(null), 3000);
  };

  const updateRole = async (userId: string, nextRole: 'admin' | 'client') => {
    setRoleSavingId(userId);
    setRolesError(null);
    try {
      const res = await fetch('/api/admin/settings/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: nextRole }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setRolesError(body.error || 'Failed to update role');
        setRoleSavingId(null);
        return;
      }
      setProfiles((prev) => prev.map((p) => (p.id === userId ? { ...p, role: nextRole } : p)));
    } catch {
      setRolesError('Failed to update role');
    } finally {
      setRoleSavingId(null);
    }
  };

  const renderPerson = (p: Profile, cta: 'promote' | 'demote') => (
    <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {[p.first_name, p.middle_initial, p.last_name].filter(Boolean).join(' ') || 'Unknown'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {p.email || 'No email'} · {p.phone || 'No phone'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {p.role || 'client'}
          </span>
          {cta === 'promote' && (
            <button
              onClick={() => updateRole(p.id, 'admin')}
              disabled={roleSavingId === p.id}
              className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-400/40 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
            >
              Promote to admin
            </button>
          )}
          {cta === 'demote' && (
            <button
              onClick={() => updateRole(p.id, 'client')}
              disabled={roleSavingId === p.id}
              className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              Remove admin
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <section className="grid gap-5">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300">Admin</p>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Settings</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">Company info, roles, and integrations.</p>
      </div>

      {/* Appearance */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Appearance</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Switch between light and dark mode</p>
          </div>
          <div className="flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {(['light', 'dark', 'system'] as const).map((value) => (
              <button
                key={value}
                className={`rounded-full px-3 py-1 transition ${
                  theme === value ? 'bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-600' : ''
                }`}
                onClick={() => setTheme(value)}
              >
                {value === 'system' ? 'System' : value === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Company profile */}
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Company profile</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">Visible to clients in emails and confirmations.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Brand name</label>
            <input
              value={company.name}
              onChange={(e) => setCompany((prev) => ({ ...prev, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:focus:ring-indigo-500/30"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Support email</label>
            <input
              value={company.supportEmail}
              onChange={(e) => setCompany((prev) => ({ ...prev, supportEmail: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:focus:ring-indigo-500/30"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Support phone</label>
            <input
              value={company.supportPhone}
              onChange={(e) => setCompany((prev) => ({ ...prev, supportPhone: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:focus:ring-indigo-500/30"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Timezone</label>
            <input
              value={company.timezone}
              onChange={(e) => setCompany((prev) => ({ ...prev, timezone: e.target.value }))}
              placeholder="America/New_York"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:focus:ring-indigo-500/30"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Service area</label>
            <input
              value={company.serviceArea}
              onChange={(e) => setCompany((prev) => ({ ...prev, serviceArea: e.target.value }))}
              placeholder="City + counties covered"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:focus:ring-indigo-500/30"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={saveCompanySettings}
            className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
          >
            Save
          </button>
          {companyMessage && <span className="text-xs font-semibold text-green-700 dark:text-green-300">{companyMessage}</span>}
        </div>
      </div>

      {/* Admin roles */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Admin roles</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Promote or demote users to admin access.</p>
          </div>
          <button
            onClick={async () => {
              setRolesLoading(true);
              setRolesError(null);
              try {
                const res = await fetch('/api/admin/settings/roles');
                if (!res.ok) {
                  const body = await res.json().catch(() => ({}));
                  setRolesError(body.error || 'Failed to load admins');
                } else {
                  const data = await res.json();
                  setProfiles(data.profiles ?? []);
                }
              } catch {
                setRolesError('Failed to load admins');
              } finally {
                setRolesLoading(false);
              }
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-300"
            disabled={rolesLoading}
          >
            {rolesLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        {rolesError && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
            {rolesError}
          </p>
        )}

        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Admins</p>
          {rolesLoading && <p className="text-sm text-slate-600 dark:text-slate-400">Loading admins...</p>}
          {!rolesLoading && !admins.length && (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
              No admins found.
            </p>
          )}
          {!rolesLoading && admins.map((p) => renderPerson(p, 'demote'))}
        </div>

        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Team / clients</p>
          {!rolesLoading && team.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
              No other users found.
            </p>
          )}
          {!rolesLoading && team.map((p) => renderPerson(p, 'promote'))}
        </div>
      </div>

      {/* Integrations */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Integrations</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Status of connected services.</p>
          </div>
          <button
            onClick={async () => {
              setIntegrationError(null);
              try {
                const res = await fetch('/api/admin/settings/integrations');
                if (!res.ok) {
                  const body = await res.json().catch(() => ({}));
                  setIntegrationError(body.error || 'Failed to load integration status');
                } else {
                  const data = await res.json();
                  setIntegrationStatus(data);
                }
              } catch {
                setIntegrationError('Failed to load integration status');
              }
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-300"
          >
            Re-check
          </button>
        </div>
        {integrationError && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
            {integrationError}
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Supabase</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge ok={Boolean(integrationStatus?.supabaseUrl)} label="URL" />
              <Badge ok={Boolean(integrationStatus?.supabaseAnonKey)} label="Anon key" />
              <Badge ok={Boolean(integrationStatus?.supabaseServiceRoleKey)} label="Service role" />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Stripe</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge ok={Boolean(integrationStatus?.stripeSecretKey)} label="Secret key" />
              <Badge ok={Boolean(integrationStatus?.stripeWebhookSecret)} label="Webhook" />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Messaging</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge ok={Boolean(integrationStatus?.twilioAuthToken)} label="Twilio" />
              <Badge ok={Boolean(integrationStatus?.resendApiKey)} label="Resend" />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Hosting</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge ok={Boolean(integrationStatus?.netlifySiteId)} label="Netlify" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
