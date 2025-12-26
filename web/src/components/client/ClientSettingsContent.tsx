'use client';

import { lazy, Suspense, useState } from 'react';

// Lazy load settings components
const ProfileForm = lazy(() => import('@/components/ProfileForm'));
const AddressesSettings = lazy(() => import('@/components/AddressesSettings'));
const NotificationSettings = lazy(() => import('@/components/NotificationSettings'));
const SecuritySettings = lazy(() => import('@/components/SecuritySettings'));
const WalletSettings = lazy(() => import('@/components/WalletSettings'));
const BillingHistory = lazy(() => import('@/components/BillingHistory'));

type SettingsTab = 'profile' | 'addresses' | 'notifications' | 'security' | 'wallet' | 'billing';

const settingsTabs: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'addresses', label: 'Addresses', icon: '📍' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'security', label: 'Security', icon: '🔒' },
  { id: 'wallet', label: 'Wallet', icon: '💳' },
  { id: 'billing', label: 'Billing', icon: '💰' },
];

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center">
        <div className="mb-2 inline-block h-6 w-6 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-700"></div>
        <p className="text-sm text-slate-600">Loading...</p>
      </div>
    </div>
  );
}

export default function ClientSettingsContent() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  return (
    <div className="space-y-6">
      {/* Settings Tab Navigation */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <div className="flex border-b border-slate-200">
            {settingsTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? 'border-indigo-700 text-indigo-700'
                    : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                <span className="text-base">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <Suspense fallback={<LoadingSpinner />}>
          {activeTab === 'profile' && (
            <section className="grid gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Account</p>
                <h2 className="text-xl font-semibold text-slate-900">Profile & Address</h2>
              </div>
              <ProfileForm />
            </section>
          )}

          {activeTab === 'addresses' && <AddressesSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'wallet' && <WalletSettings />}
          {activeTab === 'billing' && <BillingHistory />}
        </Suspense>
      </div>
    </div>
  );
}
