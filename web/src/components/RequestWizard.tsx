'use client';

import { useCallback, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { useEffect } from 'react';

type Step = 1 | 2 | 3 | 4 | 5;

type ServiceId = 'tv_mount' | 'assembly' | 'electrical' | 'punch';

type Slot = { time: string; available: boolean; startIso: string };

type RequestItem = {
  service: ServiceId;
  tvSize: string;
  wallType: string;
  hasMount: 'yes' | 'no';
  assemblyType: string;
  assemblyOther: string;
  extraItems: string[];
  notes: string;
  photoNames: string[];
};

const services: Record<
  ServiceId,
  {
    name: string;
    description: string;
    icon: string;
    options?: {
      sizes?: string[];
      wallTypes?: string[];
      hasMount?: boolean;
      assemblyTypes?: string[];
    };
  }
> = {
  tv_mount: {
    name: 'TV Mounting',
    description: 'Mount TV, hide cables, secure to studs/brick.',
    icon: '📺',
    options: {
      sizes: ['43"', '55"', '65"', '75"+'],
      wallTypes: ['Drywall', 'Brick', 'Concrete', 'Plaster'],
      hasMount: true,
    },
  },
  assembly: {
    name: 'Furniture Assembly',
    description: 'Beds, dressers, desks, patio sets, and more.',
    icon: '🛠️',
    options: {
      assemblyTypes: ['Chair', 'Sofa', 'Table/Desk', 'Bed', 'Dresser', 'Patio set', 'Lamp', 'Other'],
    },
  },
  electrical: {
    name: 'Light/Fan Swap',
    description: 'Replace fixtures, fans, dimmers, or switches.',
    icon: '💡',
  },
  punch: {
    name: 'Punch List / Misc',
    description: 'Small repairs, touch-ups, and odd jobs.',
    icon: '📋',
  },
};

const DISPLAY_TIME_ZONE = 'America/New_York';

const defaultSlots: Slot[] = [];

function nextDays(days = 14) {
  const out: { label: string; value: string }[] = [];
  const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const value = d.toISOString().slice(0, 10);
    out.push({ label: formatter.format(d), value });
  }
  return out;
}

export default function RequestWizard() {
  const { session } = useSupabaseSession();
  const supabase = getSupabaseClient();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [service, setService] = useState<ServiceId>('tv_mount');
  const [tvSize, setTvSize] = useState('55"');
  const [wallType, setWallType] = useState('Drywall');
  const [hasMount, setHasMount] = useState<'yes' | 'no'>('yes');
  const [assemblyType, setAssemblyType] = useState('Chair');
  const [assemblyOther, setAssemblyOther] = useState('');
  const [notes, setNotes] = useState('');
  const [extraItems, setExtraItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState<{ time: string; startIso: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<RequestItem[]>([]);

  const dates = useMemo(() => nextDays(14), []);
  const [availableSlots, setAvailableSlots] = useState<Record<string, Slot[]>>({});
  const [serviceDurations, setServiceDurations] = useState<Record<string, number>>({});
  const [servicePrices, setServicePrices] = useState<Record<string, number>>({});
  const selectedSlots = useMemo(() => availableSlots[date] ?? defaultSlots, [availableSlots, date]);
  const [slotDurationMinutes, setSlotDurationMinutes] = useState<number | null>(null);
  const [payMethod, setPayMethod] = useState<'pay_later' | 'card_on_file'>('pay_later');

  const reset = () => {
    setStep(1);
    setService('tv_mount');
    setTvSize('55"');
    setWallType('Drywall');
    setHasMount('yes');
    setAssemblyType('Chair');
    setAssemblyOther('');
    setNotes('');
    setExtraItems([]);
    setNewItem('');
    setPhotoNames([]);
    setDate('');
    setSlot(null);
    setStatus(null);
    setError(null);
    setItems([]);
    setPayMethod('pay_later');
  };

  // Load service catalog durations
  useEffect(() => {
    const loadDurations = async () => {
      if (!supabase) return;
      const { data, error } = await supabase.from('service_catalog').select('id, base_minutes, price_cents');
      if (error) {
        console.error('Error loading service catalog', error.message);
        return;
      }
      const map: Record<string, number> = {};
      const priceMap: Record<string, number> = {};
      (data ?? []).forEach((row) => {
        map[row.id] = row.base_minutes ?? 60;
        priceMap[row.id] = row.price_cents ?? 0;
      });
      setServiceDurations(map);
      setServicePrices(priceMap);
    };
    loadDurations();
  }, [supabase]);

  // Fetch available slots for selected date
  useEffect(() => {
    const loadSlots = async () => {
      if (!supabase || !date) return;
      const dayStart = `${date}T09:00:00`;
      const dayEnd = `${date}T20:00:00`; // include slots that start up to 7:59 PM (covers 7 PM start with 30m duration)
      const { data, error } = await supabase
        .from('available_slots')
        .select('slot_start, slot_end, is_booked')
        .gte('slot_start', dayStart)
        .lt('slot_start', dayEnd)
        .order('slot_start', { ascending: true });
      if (error) {
        console.error('Error loading slots', error.message);
        return;
      }
      if (data && data.length) {
        const durationMs = new Date(data[0].slot_end).getTime() - new Date(data[0].slot_start).getTime();
        setSlotDurationMinutes(Math.max(1, Math.round(durationMs / 60000)));
      } else {
        setSlotDurationMinutes(30);
      }
      const normalized = (data ?? []).map((row) => {
        const start = new Date(row.slot_start);
        const time = start.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: DISPLAY_TIME_ZONE,
        });
        return { time, available: !row.is_booked, startIso: row.slot_start };
      });
      setAvailableSlots((prev) => ({ ...prev, [date]: normalized.length ? normalized : [] }));
    };
    loadSlots();
  }, [date, supabase]);

  const buildCurrentItem = useCallback((): RequestItem => ({
    service,
    tvSize,
    wallType,
    hasMount,
    assemblyType,
    assemblyOther,
    extraItems,
    notes,
    photoNames,
  }), [service, tvSize, wallType, hasMount, assemblyType, assemblyOther, extraItems, notes, photoNames]);

  const getServiceId = (item: RequestItem) => {
    if (item.service === 'tv_mount') {
      if (item.tvSize === '75"+') return 'tv_mount_75';
      if (item.tvSize === '65"') return 'tv_mount_65';
      return 'tv_mount_55';
    }
    if (item.service === 'assembly') {
      switch (item.assemblyType) {
        case 'Table/Desk':
          return 'assembly_table';
        case 'Bed':
          return 'assembly_bed';
        case 'Dresser':
          return 'assembly_dresser';
        case 'Patio set':
          return 'assembly_patio';
        case 'Sofa':
          return 'assembly_sofa';
        case 'Chair':
        case 'Lamp':
          return 'assembly_chair';
        case 'Other':
        default:
          return 'assembly_other';
      }
    }
    if (item.service === 'electrical') return 'electrical';
    return 'punch';
  };

  const getMinutesForItem = useCallback(
    (item: RequestItem) => {
      const id = getServiceId(item);

      return (
        serviceDurations[id] ??
        (item.service === 'tv_mount'
          ? 60
          : item.service === 'assembly'
            ? 60
            : item.service === 'electrical'
              ? 60
              : 45)
      );
    },
    [serviceDurations],
  );

  const getPriceForItem = useCallback(
    (item: RequestItem) => {
      const id = getServiceId(item);
      return servicePrices[id] ?? 0;
    },
    [servicePrices],
  );

  const totalPriceCents = useMemo(() => {
    const allItems = [...items, buildCurrentItem()];
    return allItems.map(getPriceForItem).reduce((sum, n) => sum + n, 0);
  }, [items, buildCurrentItem, getPriceForItem]);

  const totalMinutes = useMemo(() => {
    const allItems = [...items, buildCurrentItem()];
    return allItems.map(getMinutesForItem).reduce((sum, n) => sum + n, 0);
  }, [items, buildCurrentItem, getMinutesForItem]);

  const requiredMinutes = Math.max(30, totalMinutes || 30);

  const requiredSlots = useMemo(() => {
    if (!slotDurationMinutes) return 1;
    return Math.max(1, Math.ceil(requiredMinutes / slotDurationMinutes));
  }, [requiredMinutes, slotDurationMinutes]);

  const resetItemFields = () => {
    setService('tv_mount');
    setTvSize('55"');
    setWallType('Drywall');
    setHasMount('yes');
    setAssemblyType('Chair');
    setAssemblyOther('');
    setNotes('');
    setExtraItems([]);
    setNewItem('');
    setPhotoNames([]);
    setStep(1);
  };

  const onSubmit = async () => {
    if (!session?.user || !supabase) {
      setError('Sign in to submit a request.');
      return;
    }
    if (!date || !slot) {
      setError('Select a date and time slot.');
      setStep(2);
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatus(null);

    const itemsToSave: RequestItem[] = [...items, buildCurrentItem()];

    const details = itemsToSave
      .map((item, idx) => {
        const parts = [
          `Item ${idx + 1}: ${services[item.service].name}`,
          item.service === 'tv_mount' ? `TV size: ${item.tvSize}` : null,
          item.service === 'tv_mount' ? `Wall: ${item.wallType}` : null,
          item.service === 'tv_mount' ? `Mount provided: ${item.hasMount === 'yes' ? 'Yes' : 'No'}` : null,
          item.service === 'assembly' ? `Assembly type: ${item.assemblyType}` : null,
          item.service === 'assembly' && item.assemblyType === 'Other' && item.assemblyOther
            ? `Other: ${item.assemblyOther}`
            : null,
          item.extraItems.length ? `Additional items: ${item.extraItems.join(', ')}` : null,
          item.photoNames.length ? `Photos: ${item.photoNames.join(', ')}` : null,
          item.notes ? `Notes: ${item.notes}` : null,
        ]
          .filter(Boolean)
          .join(' | ');
        return parts;
      })
      .join(' || ');
    const detailsWithDuration = `${details}${details ? ' | ' : ''}Estimated minutes: ${requiredMinutes} | Subtotal: ${(totalPriceCents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}`;

    const selectedIdx = selectedSlots.findIndex((s) => s.startIso === slot?.startIso);
    const chosenSlots = selectedIdx >= 0 ? selectedSlots.slice(selectedIdx, selectedIdx + requiredSlots) : [];
    const slotStartIso = chosenSlots.map((s) => s.startIso).filter(Boolean);

    if (!slotStartIso.length || slotStartIso.length < requiredSlots) {
      setError('Selected time no longer available. Please pick another slot.');
      setSubmitting(false);
      return;
    }

    const res = await fetch('/api/requests/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: session.user.id,
        service_type: services[service].name,
        date,
        slots: slotStartIso,
        required_minutes: requiredMinutes,
        details: detailsWithDuration || null,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Failed to submit request.');
      setSubmitting(false);
      return;
    }

    setStatus('Request submitted. We will confirm your slot shortly.');
    setSubmitting(false);
    setStep(5);
  };

  return (
    <div className="grid gap-4">
      <button
        onClick={() => {
          setOpen(true);
          reset();
        }}
        className="inline-flex items-center justify-center rounded-lg bg-indigo-700 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-800"
      >
        Start a request
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Request</p>
                <h2 className="text-xl font-semibold text-slate-900">Book a handyman visit</h2>
              </div>
              <button
                onClick={() => {
                  setOpen(false);
                }}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700 hover:border-indigo-600 hover:text-indigo-700"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5">
              <Stepper step={step} />

              {step === 1 && (
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(services).map(([id, svc]) => (
                    <button
                      key={id}
                      onClick={() => setService(id as ServiceId)}
                      className={`flex h-full flex-col items-start gap-2 rounded-xl border px-4 py-4 text-left transition ${
                        service === id
                          ? 'border-indigo-600 bg-indigo-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-indigo-200'
                      }`}
                    >
                      <span className="text-2xl">{svc.icon}</span>
                      <div className="grid gap-1">
                        <span className="text-base font-semibold text-slate-900">{svc.name}</span>
                        <span className="text-sm text-slate-600">{svc.description}</span>
                      </div>
                    </button>
                  ))}
                  {service === 'tv_mount' && (
                    <div className="md:col-span-2 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap gap-3">
                        <FieldLabel>TV size</FieldLabel>
                        <div className="flex flex-wrap gap-2">
                          {services.tv_mount.options?.sizes?.map((size) => (
                            <Chip key={size} selected={tvSize === size} onClick={() => setTvSize(size)}>
                              {size}
                            </Chip>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <FieldLabel>Wall type</FieldLabel>
                        <div className="flex flex-wrap gap-2">
                          {services.tv_mount.options?.wallTypes?.map((type) => (
                            <Chip key={type} selected={wallType === type} onClick={() => setWallType(type)}>
                              {type}
                            </Chip>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <FieldLabel>Mount provided?</FieldLabel>
                        <div className="flex gap-2">
                          <Chip selected={hasMount === 'yes'} onClick={() => setHasMount('yes')}>
                            Yes
                          </Chip>
                          <Chip selected={hasMount === 'no'} onClick={() => setHasMount('no')}>
                            No
                          </Chip>
                        </div>
                      </div>
                    </div>
                  )}

                  {service === 'assembly' && (
                    <div className="md:col-span-2 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap gap-3">
                        <FieldLabel>What are we assembling?</FieldLabel>
                        <div className="flex flex-wrap gap-2">
                          {services.assembly.options?.assemblyTypes?.map((type) => (
                            <Chip key={type} selected={assemblyType === type} onClick={() => setAssemblyType(type)}>
                              {type}
                            </Chip>
                          ))}
                        </div>
                      </div>
                      {assemblyType === 'Other' && (
                        <label className="grid gap-1 text-sm text-slate-800">
                          Describe the item
                          <input
                            type="text"
                            value={assemblyOther}
                            onChange={(e) => setAssemblyOther(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            placeholder="e.g., custom cabinet, gym equipment"
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
                  <div className="grid gap-3 rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">Pick a date</p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {dates.map((d) => (
                        <button
                          key={d.value}
                          onClick={() => setDate(d.value)}
                          className={`rounded-lg border px-3 py-2 text-left text-sm ${
                            date === d.value
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                              : 'border-slate-200 hover:border-indigo-200'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">Pick a time</p>
                    {date ? (
                      selectedSlots.length ? (
                        <div className="grid grid-cols-2 gap-2">
                          {selectedSlots.map((s, idx) => {
                            const fits =
                              slotDurationMinutes != null &&
                              selectedSlots
                                .slice(idx, idx + requiredSlots)
                                .length === requiredSlots &&
                              selectedSlots.slice(idx, idx + requiredSlots).every((slotObj) => slotObj.available);
                            const disabled = !fits;
                            return (
                              <button
                                key={s.startIso}
                                onClick={() => !disabled && setSlot({ time: s.time, startIso: s.startIso })}
                                disabled={disabled}
                                className={`rounded-lg border px-3 py-2 text-sm ${
                                  slot?.startIso === s.startIso
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                                    : 'border-slate-200 hover:border-indigo-200'
                                } ${
                                  disabled
                                    ? 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-70 line-through'
                                    : ''
                                }`}
                              >
                                {s.time}
                                {fits ? '' : ' (unavailable)'}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600">No slots available for this date.</p>
                      )
                    ) : (
                      <p className="text-sm text-slate-600">Select a date to see available times.</p>
                    )}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-3 rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">Details</p>
                  <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">Extra items</p>
                      <button
                        onClick={() => {
                          if (!newItem.trim()) return;
                          setExtraItems((prev) => [...prev, newItem.trim()]);
                          setNewItem('');
                        }}
                        className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-800"
                        type="button"
                      >
                        Add item
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      placeholder="e.g., additional chair, side table"
                    />
                    <div className="flex flex-wrap gap-2">
                      {extraItems.map((item, idx) => (
                        <span
                          key={idx}
                          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800"
                        >
                          {item}
                          <button
                            type="button"
                            onClick={() => setExtraItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-slate-500 hover:text-rose-600"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                      {!extraItems.length && <span className="text-xs text-slate-500">No extra items added yet.</span>}
                    </div>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    placeholder="Access details, parking, special requests, photos link, etc."
                  />
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-slate-900">Add photos (optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        setPhotoNames(files.map((f) => f.name));
                      }}
                      className="text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-800 hover:file:border-indigo-600 hover:file:text-indigo-700"
                    />
                    {photoNames.length > 0 && (
                      <p className="text-xs text-slate-600">Attached: {photoNames.join(', ')}</p>
                    )}
                    <p className="text-xs text-slate-500">
                      Upload support is coming soon—files are noted with your request for now.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">Items in this request</p>
                      <span className="text-xs font-semibold text-indigo-700">
                        {items.length + 1} {items.length + 1 === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {[...items, buildCurrentItem()].map((item, idx) => (
                        <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                              Item {idx + 1}
                            </span>
                            <span className="font-semibold">{services[item.service].name}</span>
                          </div>
                          <p className="text-xs text-slate-600">
                            {item.service === 'tv_mount'
                              ? `TV ${item.tvSize} | ${item.wallType} | Mount: ${item.hasMount === 'yes' ? 'Yes' : 'No'}`
                              : item.service === 'assembly'
                                ? `Assembly: ${item.assemblyType}${
                                    item.assemblyType === 'Other' && item.assemblyOther ? ` (${item.assemblyOther})` : ''
                                  }`
                                : 'Standard service'}
                          </p>
                          {item.extraItems.length > 0 && (
                            <p className="text-xs text-slate-500">Extras: {item.extraItems.join(', ')}</p>
                          )}
                          {item.photoNames.length > 0 && (
                            <p className="text-xs text-slate-500">Photos: {item.photoNames.join(', ')}</p>
                          )}
                          {item.notes && <p className="text-xs text-slate-500">Notes: {item.notes}</p>}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setItems((prev) => [...prev, buildCurrentItem()]);
                          resetItemFields();
                        }}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700"
                      >
                        Add this item & start another
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    We’ll follow up by email/SMS to confirm and gather any photos if needed.
                  </p>
                </div>
              )}

              {step === 4 && (
                <div className="grid gap-3 rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">Review & payment</p>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">Items</p>
                      <span className="text-xs font-semibold text-indigo-700">
                        {items.length + 1} {items.length + 1 === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {[...items, buildCurrentItem()].map((item, idx) => (
                        <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                Item {idx + 1}
                              </span>
                              <span className="font-semibold">{services[item.service].name}</span>
                            </div>
                            <span className="text-xs font-semibold text-slate-700">
                              {(getPriceForItem(item) / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">
                            {item.service === 'tv_mount'
                              ? `TV ${item.tvSize} | ${item.wallType} | Mount: ${item.hasMount === 'yes' ? 'Yes' : 'No'}`
                              : item.service === 'assembly'
                                ? `Assembly: ${item.assemblyType}${
                                    item.assemblyType === 'Other' && item.assemblyOther ? ` (${item.assemblyOther})` : ''
                                  }`
                                : 'Standard service'}
                          </p>
                          {item.extraItems.length > 0 && (
                            <p className="text-xs text-slate-500">Extras: {item.extraItems.join(', ')}</p>
                          )}
                          {item.notes && <p className="text-xs text-slate-500">Notes: {item.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700">Subtotal</span>
                      <span className="font-semibold text-slate-900">
                        {(totalPriceCents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700">Estimated time</span>
                      <span className="font-semibold text-slate-900">{requiredMinutes} min</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700">Selected slot</span>
                      <span className="font-semibold text-slate-900">
                        {date && slot ? `${date} @ ${slot.time}` : 'Not selected'}
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">Payment</p>
                    <label className="flex items-center gap-2 text-sm text-slate-800">
                      <input
                        type="radio"
                        name="pay_method"
                        checked={payMethod === 'pay_later'}
                        onChange={() => setPayMethod('pay_later')}
                        className="h-4 w-4 text-indigo-700 focus:ring-indigo-600"
                      />
                      Pay after confirmation (on-site or link)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-800 opacity-60">
                      <input
                        type="radio"
                        name="pay_method"
                        checked={payMethod === 'card_on_file'}
                        onChange={() => setPayMethod('card_on_file')}
                        disabled
                        className="h-4 w-4 text-indigo-700 focus:ring-indigo-600"
                      />
                      Save card (coming soon)
                    </label>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="grid gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-semibold text-green-800">All set</p>
                  <p className="text-sm text-green-900">{status}</p>
                  <button
                    onClick={() => setOpen(false)}
                    className="inline-flex w-fit items-center justify-center rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800"
                  >
                    Close
                  </button>
                </div>
              )}

              {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

              {step < 5 && (
                <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                  <div className="text-sm text-slate-600">
                    {step === 1 && 'Choose the service and options.'}
                    {step === 2 && 'Select a date and a time slot.'}
                    {step === 3 && 'Add any extra context.'}
                    {step === 4 && 'Review subtotal and payment preference.'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => (step === 1 ? setOpen(false) : setStep((prev) => (prev - 1) as Step))}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700"
                    >
                      {step === 1 ? 'Cancel' : 'Back'}
                    </button>
                    {step < 4 && (
                      <button
                        onClick={() => setStep((prev) => (prev + 1) as Step)}
                        className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        disabled={step === 2 && (!slot || selectedSlots.length === 0)}
                      >
                        Continue
                      </button>
                    )}
                    {step === 4 && (
                      <button
                        onClick={onSubmit}
                        disabled={submitting}
                        className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {submitting ? 'Submitting...' : 'Submit request'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = [
    { id: 1, label: 'Service' },
    { id: 2, label: 'Schedule' },
    { id: 3, label: 'Details' },
    { id: 4, label: 'Review' },
    { id: 5, label: 'Done' },
  ];
  return (
    <div className="grid grid-cols-5 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
      {steps.map((s) => (
        <div
          key={s.id}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
            step === s.id ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
              step >= s.id ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {s.id}
          </span>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function Chip({
  children,
  selected,
  onClick,
}: {
  children: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
        selected ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-200 hover:border-indigo-200'
      }`}
    >
      {children}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">{children}</span>;
}
