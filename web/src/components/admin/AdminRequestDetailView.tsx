'use client';

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatTime } from "@/lib/formatting";

export type RequestDetail = {
  id: string;
  user_id: string | null;
  service_type: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  details: string | null;
  status: string | null;
  estimated_minutes?: number | null;
  created_at?: string | null;
};

export type RelatedRequest = {
  id: string;
  service_type: string | null;
  status: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  created_at?: string | null;
};

export type ClientProfile = {
  first_name: string | null;
  middle_initial: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
};

type Props = {
  request: RequestDetail;
  client: ClientProfile | null;
  otherRequests: RelatedRequest[];
};

const statusOptions = ["pending", "confirmed", "complete", "cancelled"];

const statusConfig: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  confirmed: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  complete: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  cancelled: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500" },
};

function StatusBadge({ status, size = "sm" }: { status: string | null; size?: "sm" | "lg" }) {
  const label = status ?? "pending";
  const config = statusConfig[label] ?? statusConfig.pending;
  const sizeClasses = size === "lg" ? "px-4 py-1.5 text-sm" : "px-2.5 py-0.5 text-xs";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium capitalize ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {label}
    </span>
  );
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "Not set";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatShortDate(dateStr: string | null | undefined) {
  if (!dateStr) return "Not set";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(dateStr: string | null | undefined) {
  if (!dateStr) return "Not set";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

export default function AdminRequestDetailView({ request, client, otherRequests }: Props) {
  const [localRequest, setLocalRequest] = useState<RequestDetail>(request);
  const [dateInput, setDateInput] = useState(localRequest.preferred_date ?? "");
  const [timeInput, setTimeInput] = useState(localRequest.preferred_time ?? "");
  const [durationInput, setDurationInput] = useState(
    localRequest.estimated_minutes != null ? String(localRequest.estimated_minutes) : "",
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "scheduling" | "notes">("details");

  const fullName = useMemo(() => {
    if (!client) return "Unknown Client";
    return [client.first_name, client.middle_initial, client.last_name].filter(Boolean).join(" ") || "Unknown Client";
  }, [client]);

  const clientInitials = useMemo(() => {
    if (!client) return "?";
    const first = client.first_name?.[0] ?? "";
    const last = client.last_name?.[0] ?? "";
    return (first + last).toUpperCase() || "?";
  }, [client]);

  const handleUpdate = async (updates: Partial<RequestDetail>, label: string) => {
    setSaving(label);
    setMessage(null);
    setError(null);

    const res = await fetch("/api/admin/requests/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: localRequest.id, updates }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Failed to save changes.");
      setSaving(null);
      return;
    }

    setLocalRequest((prev) => ({ ...prev, ...updates }));
    setSaving(null);
    setMessage(label);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleScheduleSave = async () => {
    const minutes = durationInput.trim() ? Number(durationInput) : null;
    if (minutes != null && Number.isNaN(minutes)) {
      setError("Duration must be a number.");
      return;
    }

    await handleUpdate(
      { preferred_date: dateInput || null, preferred_time: timeInput || null, estimated_minutes: minutes },
      "Schedule updated",
    );
  };

  const statusAction = (nextStatus: string) => handleUpdate({ status: nextStatus }, `Status updated`);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:py-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-100 text-xl font-bold text-indigo-600">
            {localRequest.service_type?.[0]?.toUpperCase() ?? "S"}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{localRequest.service_type || "Service Request"}</h1>
              <StatusBadge status={localRequest.status} size="lg" />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Request #{localRequest.id.slice(0, 8)} • Created {formatRelativeTime(localRequest.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Back to Requests
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Quick Actions */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-2 text-sm font-medium text-slate-600">Quick actions:</span>
              {statusOptions.map((s) => {
                const isActive = localRequest.status === s;
                const config = statusConfig[s];
                return (
                  <button
                    key={s}
                    onClick={() => statusAction(s)}
                    disabled={saving !== null || isActive}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      isActive
                        ? `${config.bg} ${config.text} ${config.border} border`
                        : "border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
              {saving && <span className="ml-2 text-xs text-slate-500">Saving...</span>}
              {message && <span className="ml-2 text-xs font-medium text-emerald-600">{message}</span>}
              {error && <span className="ml-2 text-xs font-medium text-rose-600">{error}</span>}
            </div>
          </div>

          {/* Tabbed Content */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200">
              <nav className="flex">
                {[
                  { id: "details", label: "Details" },
                  { id: "scheduling", label: "Scheduling" },
                  { id: "notes", label: "Notes" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`px-6 py-3 text-sm font-medium transition ${
                      activeTab === tab.id
                        ? "border-b-2 border-indigo-600 text-indigo-600"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === "details" && (
                <div className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service Type</label>
                      <p className="mt-1 text-sm font-medium text-slate-900">{localRequest.service_type || "Not specified"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
                      <div className="mt-1">
                        <StatusBadge status={localRequest.status} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred Date</label>
                      <p className="mt-1 text-sm font-medium text-slate-900">{formatDate(localRequest.preferred_date)}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred Time</label>
                      <p className="mt-1 text-sm font-medium text-slate-900">{formatTime(localRequest.preferred_time) || "Not set"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</label>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {localRequest.estimated_minutes ? `${localRequest.estimated_minutes} minutes` : "Not set"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</label>
                      <p className="mt-1 text-sm font-medium text-slate-900">{formatDateTime(localRequest.created_at)}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "scheduling" && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</label>
                      <input
                        type="date"
                        value={dateInput}
                        onChange={(e) => setDateInput(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time</label>
                      <input
                        type="text"
                        value={timeInput}
                        onChange={(e) => setTimeInput(e.target.value)}
                        placeholder="e.g., 9:00 AM"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duration (min)</label>
                      <input
                        type="number"
                        value={durationInput}
                        onChange={(e) => setDurationInput(e.target.value)}
                        placeholder="60"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleScheduleSave}
                      disabled={saving !== null}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Schedule"}
                    </button>
                    <Link
                      href="/admin"
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      View Calendar
                    </Link>
                  </div>
                </div>
              )}

              {activeTab === "notes" && (
                <div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="whitespace-pre-wrap text-sm text-slate-700">
                      {localRequest.details || "No notes or details provided for this request."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Client</h3>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-bold text-white">
                {clientInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{fullName}</p>
                {client?.email && (
                  <a href={`mailto:${client.email}`} className="block truncate text-sm text-indigo-600 hover:text-indigo-700">
                    {client.email}
                  </a>
                )}
                {client?.phone && (
                  <a href={`tel:${client.phone}`} className="block text-sm text-slate-600 hover:text-slate-700">
                    {client.phone}
                  </a>
                )}
              </div>
            </div>
            {(client?.street || client?.city) && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</p>
                <p className="mt-1 text-sm text-slate-700">
                  {[client?.street, client?.city, client?.state, client?.postal_code].filter(Boolean).join(", ")}
                </p>
              </div>
            )}
          </div>

          {/* Request History */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Request History</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {otherRequests.length}
              </span>
            </div>
            {otherRequests.length === 0 ? (
              <p className="text-sm text-slate-500">No other requests from this client.</p>
            ) : (
              <div className="space-y-3">
                {otherRequests.map((item) => (
                  <Link
                    key={item.id}
                    href={`/admin/requests/${item.id}`}
                    className="block rounded-lg border border-slate-200 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{item.service_type || "Service"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatShortDate(item.preferred_date)} {item.preferred_time && `at ${formatTime(item.preferred_time)}`}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Activity</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <div className="w-px flex-1 bg-slate-200" />
                </div>
                <div className="pb-4">
                  <p className="text-sm font-medium text-slate-900">Request created</p>
                  <p className="text-xs text-slate-500">{formatDateTime(localRequest.created_at)}</p>
                </div>
              </div>
              {localRequest.status === "confirmed" && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <div className="w-px flex-1 bg-slate-200" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-slate-900">Appointment confirmed</p>
                    <p className="text-xs text-slate-500">Status updated</p>
                  </div>
                </div>
              )}
              {localRequest.status === "complete" && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Service completed</p>
                    <p className="text-xs text-slate-500">Work finished</p>
                  </div>
                </div>
              )}
              {localRequest.status === "cancelled" && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-rose-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Request cancelled</p>
                    <p className="text-xs text-slate-500">No longer active</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
