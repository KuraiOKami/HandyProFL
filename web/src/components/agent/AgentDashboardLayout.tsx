'use client';

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

// Lazy load agent section components
const AgentDashboardContent = lazy(() => import('./AgentDashboardContent'));
const AgentGigsContent = lazy(() => import('./AgentGigsContent'));
const AgentJobsContent = lazy(() => import('./AgentJobsContent'));
const AgentEarningsContent = lazy(() => import('./AgentEarningsContent'));
const AgentSettingsContent = lazy(() => import('./AgentSettingsContent'));

type Tab = 'dashboard' | 'gigs' | 'jobs' | 'earnings' | 'settings';

const tabs: { id: Tab; label: string; icon: string; mobileLabel: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', mobileLabel: 'Home' },
  { id: 'gigs', label: 'Available Gigs', icon: '🔍', mobileLabel: 'Gigs' },
  { id: 'jobs', label: 'My Jobs', icon: '🛠️', mobileLabel: 'Jobs' },
  { id: 'earnings', label: 'Earnings', icon: '💰', mobileLabel: 'Earnings' },
  { id: 'settings', label: 'Settings', icon: '⚙️', mobileLabel: 'Settings' },
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const supabase = getSupabaseClient();

  useEffect(() => {
    setActiveTab(normalizeTab(searchParams.get('tab')));
  }, [searchParams, normalizeTab]);

  // Close sidebar when tab changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [activeTab]);

  const handleTabChange = (tab: Tab) => {
    // Disable gigs tab if not approved
    if (tab === 'gigs' && agentStatus !== 'approved') return;

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

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/auth');
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
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="text-center">
          <h1 className="text-lg font-semibold text-slate-900">{activeTabInfo?.mobileLabel}</h1>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white">
          {initials}
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Hidden on mobile unless open */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full flex-col bg-slate-900 text-white transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'lg:w-16' : 'w-72 lg:w-56'}`}
      >
        {/* Logo / Brand */}
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-4">
          <div className="flex items-center gap-3">
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
          {/* Close button on mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
              const isDisabled = tab.id === 'gigs' && agentStatus !== 'approved';

              return (
                <li key={tab.id}>
                  <button
                    onClick={() => handleTabChange(tab.id)}
                    disabled={isDisabled}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                      activeTab === tab.id
                        ? 'bg-emerald-600 text-white'
                        : isDisabled
                        ? 'cursor-not-allowed text-slate-500'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="text-xl">{tab.icon}</span>
                    {!sidebarCollapsed && <span>{tab.label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse Toggle - Desktop only */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden border-t border-slate-700 px-4 py-3 text-left text-xs text-slate-400 hover:bg-slate-800 hover:text-white lg:block"
        >
          {sidebarCollapsed ? '→' : '← Collapse'}
        </button>

        {/* User Info */}
        <div className="border-t border-slate-700 px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold">
              {initials}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{userName || 'Agent'}</p>
                  {getStatusBadge()}
                </div>
                <p className="truncate text-xs text-slate-400">{userEmail}</p>
                <button
                  onClick={handleSignOut}
                  className="mt-2 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
                >
                  <span>⎋</span>
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 pb-20 lg:pb-0">
        {/* Desktop Header */}
        <header className="sticky top-0 z-10 hidden border-b border-slate-200 bg-white px-6 py-4 lg:block">
          <h1 className="text-xl font-semibold text-slate-900">{activeTabInfo?.label}</h1>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-6">
          <Suspense fallback={<LoadingSpinner />}>
            {activeTab === 'dashboard' && <AgentDashboardContent />}
            {activeTab === 'gigs' && <AgentGigsContent />}
            {activeTab === 'jobs' && <AgentJobsContent />}
            {activeTab === 'earnings' && <AgentEarningsContent />}
            {activeTab === 'settings' && <AgentSettingsContent />}
          </Suspense>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white lg:hidden">
        <div className="flex items-center justify-around py-2">
          {tabs.map((tab) => {
            const isDisabled = tab.id === 'gigs' && agentStatus !== 'approved';
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                disabled={isDisabled}
                className={`flex flex-1 flex-col items-center gap-0.5 py-1 ${
                  isActive
                    ? 'text-emerald-600'
                    : isDisabled
                    ? 'text-slate-300'
                    : 'text-slate-500'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                <span className="text-[10px] font-medium">{tab.mobileLabel}</span>
              </button>
            );
          })}
        </div>
        {/* Safe area for iPhone */}
        <div className="h-safe-area-inset-bottom bg-white" />
      </nav>
    </div>
  );
}
