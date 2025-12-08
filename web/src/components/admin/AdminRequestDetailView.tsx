'use client';

import Link from "next/link";
import { useMemo, useState } from "react";

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

function StatusBadge({ status }: { status: string | null }) {
  const label = status ?? "pending";
  const styles =
    label === "confirmed"
      ? "bg-green-50 text-green-800 border-green-200"
      : label === "complete"
        ? "bg-slate-100 text-slate-800 border-slate-200"
        : label === "cancelled"
          ? "bg-rose-50 text-rose-800 border-rose-200"
          : "bg-amber-50 text-amber-800 border-amber-200";

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${styles}`}>{label}</span>;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "Not set";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

  const fullName = useMemo(() => {
    if (!client) return "Unknown client";
    return [client.first_name, client.middle_initial, client.last_name].filter(Boolean).join(" ") || "Unknown client";
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

  const statusAction = (nextStatus: string) => handleUpdate({ status: nextStatus }, `Status set to ${nextStatus}`);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="grid gap-4 md:col-span-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={localRequest.status} />
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {localRequest.service_type || "Service"}
                </span>
                <span className="text-xs font-semibold text-slate-500">ID: {localRequest.id}</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">
                {localRequest.preferred_date ? formatDate(localRequest.preferred_date) : "No date set"} •{" "}
                {localRequest.preferred_time || "No time set"}
              </p>
              <p className="text-sm text-slate-600">
                Created {localRequest.created_at ? formatDateTime(localRequest.created_at) : "Unknown"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => statusAction("confirmed")}
                disabled={saving !== null}
                className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Mark confirmed
              </button>
              <button
                onClick={() => statusAction("complete")}
                disabled={saving !== null}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Mark complete
              </button>
              <button
                onClick={() => statusAction("cancelled")}
                disabled={saving !== null}
                className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Status</label>
              <select
                value={localRequest.status ?? "pending"}
                onChange={(e) => statusAction(e.target.value)}
                disabled={saving !== null}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Preferred date</label>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Preferred time</label>
                <input
                  type="text"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  placeholder="e.g., 9:00 AM"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Duration (min)</label>
                <input
                  type="number"
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  placeholder="60"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={handleScheduleSave}
              disabled={saving !== null}
              className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save scheduling"}
            </button>
            <Link
              href="/admin#schedule"
              className="text-sm font-semibold text-indigo-700 hover:text-indigo-800 hover:underline"
            >
              View on calendar tab
            </Link>
            {message && <span className="text-xs font-semibold text-green-700">{message}</span>}
            {error && <span className="text-xs font-semibold text-rose-700">{error}</span>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Request notes</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
            {localRequest.details || "No notes provided."}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-slate-900">Client</h3>
            {localRequest.user_id && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                {localRequest.user_id}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-800">{fullName}</p>
          <p className="text-sm text-slate-600">
            {client?.email || "No email"} • {client?.phone || "No phone"}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            {[client?.street, client?.city, client?.state, client?.postal_code].filter(Boolean).join(", ") ||
              "No address on file"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Recent requests</h3>
            <span className="text-xs font-semibold text-slate-500">{otherRequests.length || "0"} related</span>
          </div>
          <div className="mt-3 grid gap-2">
            {otherRequests.length === 0 && (
              <p className="text-sm text-slate-600">No other requests from this client yet.</p>
            )}
            {otherRequests.map((item) => (
              <Link
                key={item.id}
                href={`/admin/requests/${item.id}`}
                className="rounded-lg border border-slate-200 px-3 py-2 transition hover:border-indigo-200 hover:bg-indigo-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{item.service_type || "Service"}</span>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-xs text-slate-600">
                  {item.preferred_date ? formatDate(item.preferred_date) : "No date"} •{" "}
                  {item.preferred_time || "No time"}
                </p>
                <p className="text-[11px] text-slate-500">
                  Created {item.created_at ? formatDateTime(item.created_at) : "Unknown"}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
