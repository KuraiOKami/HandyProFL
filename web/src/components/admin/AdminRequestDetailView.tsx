'use client';

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatTime, formatCurrency } from "@/lib/formatting";

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

export type JobAssignment = {
  id: string;
  agent_id: string | null;
  status: string | null;
  job_price_cents: number | null;
  agent_payout_cents: number | null;
  platform_fee_cents: number | null;
  assigned_at: string | null;
  started_at: string | null;
  checked_out_at: string | null;
  verified_at: string | null;
  paid_at: string | null;
  completed_at: string | null;
  verification_notes: string | null;
  rejection_notes: string | null;
};

export type AgentCheckin = {
  id: string;
  type: string;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  location_verified: boolean;
};

export type ProofOfWork = {
  id: string;
  type: string;
  photo_url: string;
  notes: string | null;
  uploaded_at: string;
};

export type SurveyData = {
  satisfaction: 'satisfied' | 'neutral' | 'issues' | null;
  actual_duration: 'less' | 'expected' | 'more' | null;
  completed_tasks: 'all' | 'most' | 'some' | null;
  additional_notes: string | null;
};

type Props = {
  request: RequestDetail;
  client: ClientProfile | null;
  otherRequests: RelatedRequest[];
  jobAssignment?: JobAssignment | null;
  agentProfile?: { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
  checkins?: AgentCheckin[];
  proofs?: ProofOfWork[];
  surveyData?: SurveyData | null;
};

const statusOptions = ["pending", "confirmed", "complete", "cancelled"];

const statusConfig: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  confirmed: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  scheduled: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" },
  in_progress: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  pending_verification: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", dot: "bg-indigo-500" },
  verified: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  paid: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  complete: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  completed: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  assigned: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-500" },
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

export default function AdminRequestDetailView({ request, client, otherRequests, jobAssignment, agentProfile, checkins = [], proofs = [], surveyData }: Props) {
  const [localRequest, setLocalRequest] = useState<RequestDetail>(request);
  const [localJob, setLocalJob] = useState<JobAssignment | null>(jobAssignment ?? null);
  const [dateInput, setDateInput] = useState(localRequest.preferred_date ?? "");
  const [timeInput, setTimeInput] = useState(localRequest.preferred_time ?? "");
  const [durationInput, setDurationInput] = useState(
    localRequest.estimated_minutes != null ? String(localRequest.estimated_minutes) : "",
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "scheduling" | "notes" | "job">(
    jobAssignment?.status === "pending_verification" ? "job" : "details"
  );
  const [verificationNotes, setVerificationNotes] = useState("");

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

  const handleJobAction = async (action: string, notes?: string) => {
    if (!localJob) return;
    setSaving(action);
    setError(null);

    try {
      const res = await fetch(`/api/admin/jobs/${localJob.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${action} job`);
      }

      // Update local job state
      const statusMap: Record<string, string> = {
        verify: "verified",
        pay: "paid",
        complete: "completed",
        reject: "in_progress",
      };
      setLocalJob((prev) => prev ? { ...prev, status: statusMap[action] || prev.status } : null);

      // Also update request status for certain actions
      if (action === "complete") {
        setLocalRequest((prev) => ({ ...prev, status: "complete" }));
      }

      setMessage(`Job ${action}${action === "verify" ? " verified" : action === "pay" ? " marked paid" : action === "complete" ? " completed" : "ed"}`);
      setVerificationNotes("");
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} job`);
    } finally {
      setSaving(null);
    }
  };

  const agentName = agentProfile
    ? [agentProfile.first_name, agentProfile.last_name].filter(Boolean).join(" ") || "Unknown Agent"
    : "No agent assigned";

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
              <nav className="flex overflow-x-auto">
                {[
                  { id: "details", label: "Details" },
                  { id: "scheduling", label: "Scheduling" },
                  { id: "notes", label: "Notes" },
                  ...(localJob ? [{ id: "job", label: "Job & Verification", badge: localJob.status === "pending_verification" }] : []),
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`relative whitespace-nowrap px-6 py-3 text-sm font-medium transition ${
                      activeTab === tab.id
                        ? "border-b-2 border-indigo-600 text-indigo-600"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab.label}
                    {"badge" in tab && tab.badge && (
                      <span className="ml-1.5 inline-flex h-2 w-2 rounded-full bg-amber-500" />
                    )}
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

              {activeTab === "job" && localJob && (
                <div className="space-y-6">
                  {/* Job Status & Pricing */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Job Status</p>
                          <div className="mt-1">
                            <StatusBadge status={localJob.status} size="lg" />
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agent</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{agentName}</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
                          <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(localJob.job_price_cents ?? 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agent Pay</p>
                          <p className="mt-1 text-lg font-bold text-emerald-600">{formatCurrency(localJob.agent_payout_cents ?? 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Platform</p>
                          <p className="mt-1 text-lg font-bold text-slate-500">{formatCurrency(localJob.platform_fee_cents ?? 0)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Verification Actions */}
                  {localJob.status === "pending_verification" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <h4 className="mb-3 text-sm font-semibold text-amber-800">Review & Approve</h4>
                      <p className="mb-3 text-xs text-amber-700">
                        Review the photos above. Approving will mark the job complete and schedule agent payment.
                      </p>
                      <textarea
                        value={verificationNotes}
                        onChange={(e) => setVerificationNotes(e.target.value)}
                        placeholder="Add notes (optional)..."
                        className="mb-3 w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleJobAction("approve", verificationNotes)}
                          disabled={saving !== null}
                          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {saving === "approve" ? "Approving..." : "Approve & Complete"}
                        </button>
                        <button
                          onClick={() => handleJobAction("reject", verificationNotes)}
                          disabled={saving !== null}
                          className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          {saving === "reject" ? "Rejecting..." : "Reject"}
                        </button>
                      </div>
                    </div>
                  )}

                  {localJob.status === "completed" && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <h4 className="text-sm font-semibold text-emerald-800">Job Completed</h4>
                      <p className="text-xs text-emerald-600">Agent payment scheduled (available in ~2 hours)</p>
                    </div>
                  )}

                  {/* Rejection Notes */}
                  {localJob.rejection_notes && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Previous Rejection</p>
                      <p className="mt-1 text-sm text-rose-600">{localJob.rejection_notes}</p>
                    </div>
                  )}

                  {/* Proof of Work Photos */}
                  <div>
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Proof of Work</h4>
                    {proofs.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
                        <p className="text-sm text-slate-500">No photos uploaded yet</p>
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {proofs.map((proof) => (
                          <div key={proof.id} className="space-y-2">
                            <p className="text-xs font-medium text-slate-600">
                              {proof.type === "box" ? "Before (Box/Materials)" : "After (Completed Work)"}
                            </p>
                            <div className="relative h-48 w-full overflow-hidden rounded-lg bg-slate-100">
                              <Image
                                src={proof.photo_url}
                                alt={proof.type}
                                fill
                                className="object-contain"
                                unoptimized
                              />
                            </div>
                            {proof.notes && (
                              <p className="text-xs text-slate-500">{proof.notes}</p>
                            )}
                            <p className="text-xs text-slate-400">{formatDateTime(proof.uploaded_at)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Agent Check-in Timeline */}
                  {checkins.length > 0 && (
                    <div>
                      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Agent Timeline</h4>
                      <div className="rounded-lg border border-slate-200 p-4">
                        <div className="space-y-3">
                          {checkins.map((checkin) => (
                            <div key={checkin.id} className="flex items-start gap-3">
                              <div className={`mt-0.5 h-2 w-2 rounded-full ${
                                checkin.type === "checkin" ? "bg-blue-500" : "bg-emerald-500"
                              }`} />
                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  {checkin.type === "checkin" ? "Checked In" : "Checked Out"}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {formatDateTime(checkin.created_at)}
                                  {checkin.location_verified && (
                                    <span className="ml-2 text-emerald-600">Location verified</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Agent Survey Responses */}
                  {surveyData && (
                    <div>
                      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Agent Survey</h4>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div>
                            <p className="text-xs font-medium text-slate-500">Customer Satisfaction</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {surveyData.satisfaction === 'satisfied' && '😊 Satisfied'}
                              {surveyData.satisfaction === 'neutral' && '😐 Neutral'}
                              {surveyData.satisfaction === 'issues' && '😟 Had Issues'}
                              {!surveyData.satisfaction && 'Not answered'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500">Actual Duration</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {surveyData.actual_duration === 'less' && '⏱️ Less than expected'}
                              {surveyData.actual_duration === 'expected' && '⏱️ As expected'}
                              {surveyData.actual_duration === 'more' && '⏱️ More than expected'}
                              {!surveyData.actual_duration && 'Not answered'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500">Tasks Completed</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {surveyData.completed_tasks === 'all' && '✅ All tasks'}
                              {surveyData.completed_tasks === 'most' && '📋 Most tasks'}
                              {surveyData.completed_tasks === 'some' && '⚠️ Some tasks'}
                              {!surveyData.completed_tasks && 'Not answered'}
                            </p>
                          </div>
                        </div>
                        {surveyData.additional_notes && (
                          <div className="mt-4 border-t border-slate-200 pt-4">
                            <p className="text-xs font-medium text-slate-500">Agent Notes</p>
                            <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{surveyData.additional_notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Agent Contact Info */}
                  {agentProfile && (
                    <div>
                      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Agent Contact</h4>
                      <div className="rounded-lg border border-slate-200 p-4">
                        <p className="font-medium text-slate-900">{agentName}</p>
                        {agentProfile.email && (
                          <a href={`mailto:${agentProfile.email}`} className="block text-sm text-indigo-600 hover:text-indigo-700">
                            {agentProfile.email}
                          </a>
                        )}
                        {agentProfile.phone && (
                          <a href={`tel:${agentProfile.phone}`} className="block text-sm text-slate-600 hover:text-slate-700">
                            {agentProfile.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
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
              {/* Request created */}
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

              {/* Job assigned */}
              {jobAssignment?.assigned_at && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    <div className="w-px flex-1 bg-slate-200" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-slate-900">Agent assigned</p>
                    <p className="text-xs text-slate-500">{formatDateTime(jobAssignment.assigned_at)}</p>
                  </div>
                </div>
              )}

              {/* Agent checked in */}
              {checkins?.find(c => c.type === "checkin") && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <div className="w-px flex-1 bg-slate-200" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-slate-900">Agent checked in</p>
                    <p className="text-xs text-slate-500">{formatDateTime(checkins.find(c => c.type === "checkin")?.created_at)}</p>
                  </div>
                </div>
              )}

              {/* Box photo uploaded */}
              {proofs?.find(p => p.type === "box") && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <div className="w-px flex-1 bg-slate-200" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-slate-900">Before photo uploaded</p>
                    <p className="text-xs text-slate-500">{formatDateTime(proofs.find(p => p.type === "box")?.uploaded_at)}</p>
                  </div>
                </div>
              )}

              {/* Finished photo uploaded */}
              {proofs?.find(p => p.type === "finished") && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <div className="w-px flex-1 bg-slate-200" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-slate-900">After photo uploaded</p>
                    <p className="text-xs text-slate-500">{formatDateTime(proofs.find(p => p.type === "finished")?.uploaded_at)}</p>
                  </div>
                </div>
              )}

              {/* Agent checked out */}
              {checkins?.find(c => c.type === "checkout") && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-indigo-500" />
                    <div className="w-px flex-1 bg-slate-200" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-slate-900">Agent checked out</p>
                    <p className="text-xs text-slate-500">{formatDateTime(checkins.find(c => c.type === "checkout")?.created_at)}</p>
                  </div>
                </div>
              )}

              {/* Job verified */}
              {jobAssignment?.verified_at && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <div className="w-px flex-1 bg-slate-200" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-slate-900">Work verified</p>
                    <p className="text-xs text-slate-500">{formatDateTime(jobAssignment.verified_at)}</p>
                  </div>
                </div>
              )}

              {/* Agent paid */}
              {jobAssignment?.paid_at && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <div className="w-px flex-1 bg-slate-200" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-slate-900">Agent paid</p>
                    <p className="text-xs text-slate-500">{formatDateTime(jobAssignment.paid_at)}</p>
                  </div>
                </div>
              )}

              {/* Job completed */}
              {jobAssignment?.completed_at && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Job completed</p>
                    <p className="text-xs text-slate-500">{formatDateTime(jobAssignment.completed_at)}</p>
                  </div>
                </div>
              )}

              {/* Cancelled status (show if no job or job cancelled) */}
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
