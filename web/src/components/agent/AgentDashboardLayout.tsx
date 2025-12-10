'use client';

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// Lazy load agent section components
const AgentDashboardContent = lazy(() => import('./AgentDashboardContent'));
const AgentGigsContent = lazy(() => import('./AgentGigsContent'));
const AgentJobsContent = lazy(() => import('./AgentJobsContent'));
const AgentEarningsContent = lazy(() => import('./AgentEarningsContent'));
const AgentSettingsContent = lazy(() => import('./AgentSettingsContent'));

type Tab = 'dashboard' | 'gigs' | 'jobs' | 'earnings' | 'settings';

const tabs: { id: Tab; label: string; icon: string; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', description: 'Your overview and stats' },
  { id: 'gigs', label: 'Available Gigs', icon: '🔍', description: 'Find and accept new jobs' },
  { id: 'jobs', label: 'My Jobs', icon: '🛠️', description: 'Your assigned and completed jobs' },
  { id: 'earnings', label: 'Earnings', icon: '💰', description: 'Track your earnings and payouts' },
  { id: 'settings', label: 'Settings', icon: '⚙️', description: 'Profile and payment setup' },
];

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700"></div>
        <p className="text-sm text-slate-600">Loading...</p>
      </div>
    </div>
  );
}

type Props = {
  userEmail?: string;
  userName?: string;
  agentStatus?: string;
  stripeConnected?: boolean;
};

export default function AgentDashboardLayout({ userEmail, userName, agentStatus, stripeConnected }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const normalizeTab = useMemo(() => {
    const set = new Set(tabs.map((t) => t.id));
    return (value: string | null): Tab => (set.has(value as Tab) ? (value as Tab) : 'dashboard');
  }, []);

  const [activeTab, setActiveTab] = useState<Tab>(() => normalizeTab(searchParams.get('tab')));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setActiveTab(normalizeTab(searchParams.get('tab')));
  }, [searchParams, normalizeTab]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    if (tab === 'dashboard') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const initials = userName
    ? userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : userEmail?.slice(0, 2).toUpperCase() || 'AG';

  const getStatusBadge = () => {
    if (agentStatus === 'approved') {
      return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Active</span>;
    }
    if (agentStatus === 'pending_approval') {
      return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Pending</span>;
    }
    if (agentStatus === 'suspended') {
      return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Suspended</span>;
    }
    return null;
  };

  const activeTabInfo = tabs.find((t) => t.id === activeTab);

  return (
    <div className="flex min-h-[calc(100vh-2rem)]">
      {/* Sidebar */}
      <aside
        className={`sticky top-0 flex h-screen flex-col bg-slate-900 text-white transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Logo / Brand */}
        <div className="flex items-center gap-3 border-b border-slate-700 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-lg font-bold">
            H
          </div>
          {!sidebarCollapsed && (
            <div>
              <p className="text-sm font-semibold">HandyProFL</p>
              <p className="text-xs text-slate-400">Agent Portal</p>
            </div>
          )}
        </div>

        {/* Status Banner */}
        {!sidebarCollapsed && agentStatus === 'pending_approval' && (
          <div className="border-b border-slate-700 bg-amber-900/30 px-4 py-2">
            <p className="text-xs text-amber-200">Account pending approval</p>
          </div>
        )}

        {!sidebarCollapsed && !stripeConnected && agentStatus === 'approved' && (
          <div className="border-b border-slate-700 bg-rose-900/30 px-4 py-2">
            <p className="text-xs text-rose-200">Set up payments to get paid</p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {tabs.map((tab) => {
              // Disable gigs tab if not approved
              const isDisabled = tab.id === 'gigs' && agentStatus !== 'approved';

              return (
                <li key={tab.id}>
                  <button
                    onClick={() => !isDisabled && handleTabChange(tab.id)}
                    disabled={isDisabled}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      activeTab === tab.id
                        ? 'bg-emerald-600 text-white'
                        : isDisabled
                        ? 'cursor-not-allowed text-slate-500'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    title={sidebarCollapsed ? tab.label : isDisabled ? 'Account approval required' : undefined}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    {!sidebarCollapsed && <span>{tab.label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="border-t border-slate-700 px-4 py-3 text-left text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          {sidebarCollapsed ? '→' : '← Collapse'}
        </button>

        {/* User Info */}
        <div className="border-t border-slate-700 px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold">
              {initials}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{userName || 'Agent'}</p>
                  {getStatusBadge()}
                </div>
                <p className="truncate text-xs text-slate-400">{userEmail}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-slate-50">
        {/* Top Header */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{activeTabInfo?.label}</h1>
              <p className="text-sm text-slate-500">{activeTabInfo?.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          <Suspense fallback={<LoadingSpinner />}>
            {activeTab === 'dashboard' && <AgentDashboardContent />}
            {activeTab === 'gigs' && <AgentGigsContent />}
            {activeTab === 'jobs' && <AgentJobsContent />}
            {activeTab === 'earnings' && <AgentEarningsContent />}
            {activeTab === 'settings' && <AgentSettingsContent />}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
