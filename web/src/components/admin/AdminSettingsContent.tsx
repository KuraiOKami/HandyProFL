'use client';

import { useEffect, useMemo, useState } from 'react';

type CompanySettings = {
  name: string;
  supportEmail: string;
  supportPhone: string;
  timezone: string;
  serviceArea: string;
  webhookUrl: string;
  apiKeyLabel: string;
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
  serviceArea: 'Jacksonville + nearby counties',
  webhookUrl: 'https://example.com/webhooks/handypro',
  apiKeyLabel: 'Netlify Functions secret',
};

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
        ok ? 'bg-green-50 text-green-800 ring-1 ring-green-200' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-green-500' : 'bg-amber-500'}`} />
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
    setCompanyMessage('Saved locally. For shared storage, wire this to a Supabase table.');
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
    <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {[p.first_name, p.middle_initial, p.last_name].filter(Boolean).join(' ') || 'Unknown'}
          </p>
          <p className="text-xs text-slate-600">
            {p.email || 'No email'} • {p.phone || 'No phone'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
            {p.role || 'client'}
          </span>
          {cta === 'promote' && (
            <button
              onClick={() => updateRole(p.id, 'admin')}
              disabled={roleSavingId === p.id}
              className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Promote to admin
            </button>
          )}
          {cta === 'demote' && (
            <button
              onClick={() => updateRole(p.id, 'client')}
              disabled={roleSavingId === p.id}
              className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
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
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-600">Branding, roles, integrations, and guardrails.</p>
      </div>

      {/* Company profile */}
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Company profile</h3>
            <p className="text-sm text-slate-600">Visible to clients in emails and confirmations.</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">Local-only storage</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Brand name</label>
            <input
              value={company.name}
              onChange={(e) => setCompany((prev) => ({ ...prev, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Support email</label>
            <input
              value={company.supportEmail}
              onChange={(e) => setCompany((prev) => ({ ...prev, supportEmail: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Support phone</label>
            <input
              value={company.supportPhone}
              onChange={(e) => setCompany((prev) => ({ ...prev, supportPhone: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Timezone</label>
            <input
              value={company.timezone}
              onChange={(e) => setCompany((prev) => ({ ...prev, timezone: e.target.value }))}
              placeholder="America/New_York"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Service area</label>
            <input
              value={company.serviceArea}
              onChange={(e) => setCompany((prev) => ({ ...prev, serviceArea: e.target.value }))}
              placeholder="City + counties covered"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Webhook endpoint</label>
            <input
              value={company.webhookUrl}
              onChange={(e) => setCompany((prev) => ({ ...prev, webhookUrl: e.target.value }))}
              placeholder="https://example.com/webhooks/handypro"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-xs text-slate-500">Use this for Stripe, Netlify functions, or Supabase webhooks.</p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">API key label</label>
            <input
              value={company.apiKeyLabel}
              onChange={(e) => setCompany((prev) => ({ ...prev, apiKeyLabel: e.target.value }))}
              placeholder="E.g., Stripe live secret"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-xs text-slate-500">Label only; do not paste secrets in the browser UI.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={saveCompanySettings}
            className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
          >
            Save
          </button>
          <p className="text-xs text-slate-500">
            Prefer a shared backend? Add a `company_settings` table and wire this section to an admin API.
          </p>
          {companyMessage && <span className="text-xs font-semibold text-green-700">{companyMessage}</span>}
        </div>
      </div>

      {/* Admin roles */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Admin roles</h3>
            <p className="text-sm text-slate-600">Promote or demote admins. Requires service role key to edit others.</p>
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
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={rolesLoading}
          >
            {rolesLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {rolesError && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{rolesError}</p>}

        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Admins</p>
          {rolesLoading && <p className="text-sm text-slate-600">Loading admins…</p>}
          {!rolesLoading && !admins.length && (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              No admins found.
            </p>
          )}
          {!rolesLoading && admins.map((p) => renderPerson(p, 'demote'))}
        </div>

        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Team / clients</p>
          {!rolesLoading && team.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              No other users found.
            </p>
          )}
          {!rolesLoading && team.map((p) => renderPerson(p, 'promote'))}
        </div>
      </div>

      {/* Integrations */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">API keys & webhooks</h3>
            <p className="text-sm text-slate-600">Quick health check for env vars powering billing and messaging.</p>
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
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700"
          >
            Re-run checks
          </button>
        </div>
        {integrationError && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{integrationError}</p>
        )}
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Supabase</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge ok={Boolean(integrationStatus?.supabaseUrl)} label="URL" />
              <Badge ok={Boolean(integrationStatus?.supabaseAnonKey)} label="Anon key" />
              <Badge ok={Boolean(integrationStatus?.supabaseServiceRoleKey)} label="Service role key" />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Service role is required for admin dashboards to bypass RLS for reporting.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Stripe</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge ok={Boolean(integrationStatus?.stripeSecretKey)} label="Secret key" />
              <Badge ok={Boolean(integrationStatus?.stripeWebhookSecret)} label="Webhook secret" />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              For wallet/cards and off-session charges. Set in Netlify environment variables.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Messaging</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge ok={Boolean(integrationStatus?.twilioAuthToken)} label="Twilio" />
              <Badge ok={Boolean(integrationStatus?.resendApiKey)} label="Resend" />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Twilio enables SMS OTP; Resend supports transactional emails.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Deploy</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge ok={Boolean(integrationStatus?.netlifySiteId)} label="Netlify site ID" />
              <Badge ok={Boolean(integrationStatus?.supabaseAnonKey)} label="Client envs present" />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Keep secrets in Netlify/Env Vault. Do not paste keys into the dashboard.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
