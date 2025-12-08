'use client';

import { lazy, Suspense, useState } from 'react';

// Lazy load admin section components
const AdminDashboardContent = lazy(() => import('./admin/AdminDashboardContent'));
const AdminRequestsContent = lazy(() => import('./admin/AdminRequestsContent'));
const AdminClientsContent = lazy(() => import('./admin/AdminClientsContent'));
const AdminScheduleContent = lazy(() => import('./admin/AdminScheduleContent'));
const AdminServicesContent = lazy(() => import('./admin/AdminServicesContent'));
const AdminBillingContent = lazy(() => import('./admin/AdminBillingContent'));
const AdminNotificationsContent = lazy(() => import('./admin/AdminNotificationsContent'));
const AdminFilesContent = lazy(() => import('./admin/AdminFilesContent'));
const AdminSettingsContent = lazy(() => import('./admin/AdminSettingsContent'));
const AdminActivityContent = lazy(() => import('./admin/AdminActivityContent'));

type Tab = 'dashboard' | 'requests' | 'clients' | 'schedule' | 'services' | 'billing' | 'notifications' | 'files' | 'settings' | 'activity';

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'requests', label: 'Requests', icon: '📋' },
  { id: 'clients', label: 'Clients', icon: '👥' },
  { id: 'schedule', label: 'Schedule', icon: '📅' },
  { id: 'services', label: 'Services', icon: '🛠️' },
  { id: 'billing', label: 'Billing', icon: '💰' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'files', label: 'Files', icon: '📁' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'activity', label: 'Activity', icon: '📈' },
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

export default function AdminDashboardTabbed() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <div className="grid gap-6">
      {/* Tab Navigation */}
      <div className="sticky top-0 z-10 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <div className="flex border-b border-slate-200">
            {tabs.map((tab) => (
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

      {/* Tab Content */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <Suspense fallback={<LoadingSpinner />}>
          {activeTab === 'dashboard' && <AdminDashboardContent />}
          {activeTab === 'requests' && <AdminRequestsContent />}
          {activeTab === 'clients' && <AdminClientsContent />}
          {activeTab === 'schedule' && <AdminScheduleContent />}
          {activeTab === 'services' && <AdminServicesContent />}
          {activeTab === 'billing' && <AdminBillingContent />}
          {activeTab === 'notifications' && <AdminNotificationsContent />}
          {activeTab === 'files' && <AdminFilesContent />}
          {activeTab === 'settings' && <AdminSettingsContent />}
          {activeTab === 'activity' && <AdminActivityContent />}
        </Suspense>
      </div>
    </div>
  );
}
