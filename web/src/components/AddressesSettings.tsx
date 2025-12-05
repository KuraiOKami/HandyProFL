"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Address = {
  id: string;
  label: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  is_primary: boolean | null;
};

const emptyAddress = {
  label: "",
  street: "",
  city: "",
  state: "",
  postal_code: "",
};

export default function AddressesSettings() {
  const { session } = useSupabaseSession();
  const supabase = getSupabaseClient();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState(emptyAddress);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user?.id ?? null;
  const canFetch = useMemo(
    () => Boolean(userId && supabase),
    [userId, supabase]
  );

  useEffect(() => {
    const load = async () => {
      if (!canFetch || !supabase) return;
      const client = supabase;
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await client
        .from("addresses")
        .select("id, label, street, city, state, postal_code, is_primary")
        .eq("user_id", userId)
        .order("is_primary", { ascending: false });
      if (fetchError) {
        setError(fetchError.message);
      } else {
        setAddresses(data ?? []);
      }
      setLoading(false);
    };
    load();
  }, [canFetch, supabase, userId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !userId) {
      setError("Sign in to add an address.");
      return;
    }
    const client = supabase;
    setSaving(true);
    setStatus(null);
    setError(null);
    const { error: insertError } = await client.from("addresses").insert({
      user_id: userId,
      label: form.label || "Home",
      street: form.street,
      city: form.city,
      state: form.state,
      postal_code: form.postal_code,
      is_primary: addresses.length === 0,
    });
    if (insertError) {
      setError(insertError.message);
    } else {
      setForm(emptyAddress);
      setStatus("Address saved.");
      // refresh
      const { data } = await client
        .from("addresses")
        .select("id, label, street, city, state, postal_code, is_primary")
        .eq("user_id", userId)
        .order("is_primary", { ascending: false });
      setAddresses(data ?? []);
    }
    setSaving(false);
  };

  const setPrimary = async (id: string) => {
    if (!supabase || !userId) return;
    const client = supabase;
    setSaving(true);
    setError(null);
    await client
      .from("addresses")
      .update({ is_primary: false })
      .eq("user_id", userId);
    const { error: updateError } = await client
      .from("addresses")
      .update({ is_primary: true })
      .eq("id", id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setAddresses((prev) =>
        prev.map((addr) => ({
          ...addr,
          is_primary: addr.id === id ? true : false,
        }))
      );
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!supabase || !userId) return;
    const client = supabase;
    setSaving(true);
    setError(null);
    const { error: deleteError } = await client
      .from("addresses")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setAddresses((prev) => prev.filter((addr) => addr.id !== id));
    }
    setSaving(false);
  };

  return (
    <div className="grid gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">
            Addresses
          </p>
          <h2 className="text-xl font-semibold text-slate-900">
            Service locations
          </h2>
          <p className="text-sm text-slate-600">
            Save multiple addresses and pick a primary.
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2 md:gap-4">
        <label className="grid gap-1 text-sm text-slate-800">
          Label
          <input
            type="text"
            value={form.label}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="Home, Office"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-800">
          Street
          <input
            type="text"
            value={form.street}
            onChange={(e) => setForm((p) => ({ ...p, street: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="123 Main St"
            required
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-800">
          City
          <input
            type="text"
            value={form.city}
            onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="Tampa"
            required
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-800">
          State
          <input
            type="text"
            value={form.state}
            onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="FL"
            required
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-800">
          Postal code
          <input
            type="text"
            value={form.postal_code}
            onChange={(e) =>
              setForm((p) => ({ ...p, postal_code: e.target.value }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="33601"
            required
          />
        </label>
        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving || !session}
            className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? "Saving..." : "Add address"}
          </button>
          <p className="text-xs text-slate-500">
            Addresses save to the{" "}
            <code className="rounded bg-slate-100 px-1">addresses</code> table.
          </p>
        </div>
      </form>

      {loading && (
        <p className="text-sm text-slate-600">Loading addresses...</p>
      )}
      {error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      <div className="grid gap-3">
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"
          >
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {addr.label || "Address"}
                </span>
                {addr.is_primary && (
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                    Primary
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700">
                {[addr.street, addr.city, addr.state, addr.postal_code]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPrimary(addr.id)}
                disabled={saving || !!addr.is_primary}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Set primary
              </button>
              <button
                onClick={() => remove(addr.id)}
                disabled={saving}
                className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        {!addresses.length && !loading && !error && (
          <p className="text-sm text-slate-600">No saved addresses yet.</p>
        )}
      </div>
      {status && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {status}
        </p>
      )}
    </div>
  );
}
