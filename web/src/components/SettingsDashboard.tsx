"use client";

import { useEffect, useMemo, useState } from "react";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { getSupabaseClient } from "@/lib/supabaseClient";
import ProfileForm from "./ProfileForm";
import AddressesSettings from "./AddressesSettings";
import NotificationSettings from "./NotificationSettings";
import SecuritySettings from "./SecuritySettings";

type Request = {
  id: string;
  service_type: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  details: string | null;
  status: string | null;
  created_at: string | null;
};

export default function SettingsDashboard() {
  const { session } = useSupabaseSession();
  const supabase = getSupabaseClient();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user?.id ?? null;
  const canFetch = useMemo(
    () => Boolean(userId && supabase),
    [userId, supabase]
  );

  useEffect(() => {
    const load = async () => {
      if (!canFetch || !supabase) return;
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("service_requests")
        .select(
          "id, service_type, preferred_date, preferred_time, details, status, created_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (fetchError) {
        setError(fetchError.message);
      } else {
        setRequests(data ?? []);
      }
      setLoading(false);
    };
    load();
  }, [canFetch, supabase, userId]);

  const updateRequest = async (id: string, updates: Partial<Request>) => {
    if (!supabase || !userId) return;
    setSavingId(id);
    setError(null);
    const { error: updateError } = await supabase
      .from("service_requests")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId);
    if (updateError) {
      setError(updateError.message);
    } else {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
    }
    setSavingId(null);
  };

  const handleCancel = (id: string) =>
    updateRequest(id, { status: "cancelled" });
  const handleReschedule = (
    id: string,
    preferred_date: string | null,
    preferred_time: string | null
  ) => updateRequest(id, { preferred_date, preferred_time, status: "pending" });

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">
              Account
            </p>
            <h2 className="text-xl font-semibold text-slate-900">
              Profile & address
            </h2>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            Settings
          </span>
        </div>
        <ProfileForm />
      </section>

      <AddressesSettings />
      <NotificationSettings />
      <SecuritySettings />

      <section className="grid gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">
              Billing
            </p>
            <h2 className="text-xl font-semibold text-slate-900">Wallet</h2>
            <p className="text-sm text-slate-600">
              Save a card for quick confirmations. (Coming soon.)
            </p>
          </div>
          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm">
            Add payment method
          </button>
        </div>
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Card storage will land here. For now, we will confirm billing after
          scheduling.
        </div>
      </section>

      <section className="grid gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">
              Requests
            </p>
            <h2 className="text-xl font-semibold text-slate-900">
              Manage bookings
            </h2>
            <p className="text-sm text-slate-600">
              Reschedule or cancel. New requests can be created on the Requests
              page.
            </p>
          </div>
        </div>
        {!session && (
          <p className="text-sm text-amber-700">
            Sign in to view your requests.
          </p>
        )}
        {session && (
          <div className="grid gap-3">
            {loading && (
              <p className="text-sm text-slate-600">Loading requests...</p>
            )}
            {error && (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            )}
            {!loading && !requests.length && !error && (
              <p className="text-sm text-slate-600">
                No requests yet. Create one on the Requests page.
              </p>
            )}
            {requests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                onCancel={handleCancel}
                onReschedule={handleReschedule}
                saving={savingId === req.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type RequestCardProps = {
  request: Request;
  onCancel: (id: string) => void;
  onReschedule: (
    id: string,
    preferred_date: string | null,
    preferred_time: string | null
  ) => void;
  saving: boolean;
};

function RequestCard({
  request,
  onCancel,
  onReschedule,
  saving,
}: RequestCardProps) {
  const [preferredDate, setPreferredDate] = useState(
    request.preferred_date ?? ""
  );
  const [preferredTime, setPreferredTime] = useState(
    request.preferred_time ?? ""
  );

  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            {request.service_type || "Service"}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
            {request.status || "pending"}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Created{" "}
          {request.created_at
            ? new Date(request.created_at).toLocaleString()
            : "—"}
        </p>
      </div>
      <p className="text-sm text-slate-700">
        {request.details || "No additional notes provided."}
      </p>
      <div className="grid gap-3 md:grid-cols-3 md:items-end md:gap-4">
        <label className="grid gap-1 text-sm text-slate-800">
          Preferred date
          <input
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-800">
          Preferred time
          <input
            type="text"
            value={preferredTime}
            onChange={(e) => setPreferredTime(e.target.value)}
            placeholder="e.g., 9–11 AM"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              onReschedule(
                request.id,
                preferredDate || null,
                preferredTime || null
              )
            }
            disabled={saving}
            className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? "Saving..." : "Reschedule"}
          </button>
          <button
            onClick={() => onCancel(request.id)}
            disabled={saving}
            className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
