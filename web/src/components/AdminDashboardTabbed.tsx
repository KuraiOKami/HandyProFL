'use client';

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Lazy load admin section components
const AdminDashboardContent = lazy(() => import('./admin/AdminDashboardContent'));
const AdminRequestsContent = lazy(() => import('./admin/AdminRequestsContent'));
const AdminClientsContent = lazy(() => import('./admin/AdminClientsContent'));
const AdminScheduleContent = lazy(() => import('./admin/AdminScheduleContent'));
const AdminServicesContent = lazy(() => import('./admin/AdminServicesContent'));
const AdminBillingContent = lazy(() => import('./admin/AdminBillingContent'));
const AdminSettingsContent = lazy(() => import('./admin/AdminSettingsContent'));

type Tab = 'dashboard' | 'requests' | 'clients' | 'schedule' | 'services' | 'billing' | 'settings';

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'requests', label: 'Requests', icon: '📋' },
  { id: 'clients', label: 'Clients', icon: '👥' },
  { id: 'schedule', label: 'Schedule', icon: '📅' },
  { id: 'services', label: 'Services', icon: '🛠️' },
  { id: 'billing', label: 'Billing', icon: '💰' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-700"></div>
        <p className="text-sm text-slate-600">Loading...</p>
      </div>
    </div>
  );
}

type Props = {
  userEmail?: string;
  userName?: string;
};

export default function AdminDashboardTabbed({ userEmail, userName }: Props) {
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
    : userEmail?.slice(0, 2).toUpperCase() || 'AD';

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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold">
            H
          </div>
          {!sidebarCollapsed && (
            <div>
              <p className="text-sm font-semibold">HandyProFL</p>
              <p className="text-xs text-slate-400">Admin Panel</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  title={sidebarCollapsed ? tab.label : undefined}
                >
                  <span className="text-lg">{tab.icon}</span>
                  {!sidebarCollapsed && <span>{tab.label}</span>}
                </button>
              </li>
            ))}
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
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500 text-sm font-semibold">
              {initials}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{userName || 'Admin'}</p>
                <p className="truncate text-xs text-slate-400">{userEmail || 'admin@handyprofl.com'}</p>
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
              <h1 className="text-xl font-semibold text-slate-900 capitalize">{activeTab}</h1>
              <p className="text-sm text-slate-500">
                {activeTab === 'dashboard' && 'Overview of your business'}
                {activeTab === 'requests' && 'Manage service requests'}
                {activeTab === 'clients' && 'CRM-style client management'}
                {activeTab === 'schedule' && 'Availability and appointments'}
                {activeTab === 'services' && 'Service catalog management'}
                {activeTab === 'billing' && 'Revenue and payment tracking'}
                {activeTab === 'settings' && 'System configuration'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Help
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          <Suspense fallback={<LoadingSpinner />}>
            {activeTab === 'dashboard' && <AdminDashboardContent />}
            {activeTab === 'requests' && <AdminRequestsContent />}
            {activeTab === 'clients' && <AdminClientsContent />}
            {activeTab === 'schedule' && <AdminScheduleContent />}
            {activeTab === 'services' && <AdminServicesContent />}
            {activeTab === 'billing' && <AdminBillingContent />}
            {activeTab === 'settings' && <AdminSettingsContent />}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
