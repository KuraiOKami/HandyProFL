import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';

export type Step = 1 | 2 | 3 | 4 | 5;
export type ServiceId = 'tv_mount' | 'assembly' | 'electrical' | 'punch';

export type Slot = { time: string; available: boolean; startIso: string };
export type PaymentMethod = {
  id: string;
  brand?: string | null;
  last4?: string | null;
  exp_month?: number | null;
  exp_year?: number | null;
};

export type MountType = 'none' | 'static' | 'full_motion';

export type RequestItem = {
  service: ServiceId;
  tvSize: string;
  wallType: string;
  hasMount: 'yes' | 'no';
  mountType: MountType;
  assemblyType: string;
  assemblyOther: string;
  extraItems: string[];
  notes: string;
  photoNames: string[];
};

// Mount upcharge prices in cents
export const MOUNT_UPCHARGES: Record<MountType, number> = {
  none: 0,
  static: 3000, // $30
  full_motion: 7000, // $70
};

export const services: Record<
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
    name: 'General Handyman (Hourly)',
    description: 'Mixed small jobs, billed hourly with materials as needed.',
    icon: '📋',
  },
};

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

export function useRequestWizard() {
  const { session } = useSupabaseSession();
  const supabase = getSupabaseClient();

  // Step & modal state
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);

  // Service selection state
  const [service, setService] = useState<ServiceId>('tv_mount');
  const [tvSize, setTvSize] = useState('55"');
  const [wallType, setWallType] = useState('Drywall');
  const [hasMount, setHasMount] = useState<'yes' | 'no'>('yes');
  const [mountType, setMountType] = useState<MountType>('none');
  const [assemblyType, setAssemblyType] = useState('Chair');
  const [assemblyOther, setAssemblyOther] = useState('');

  // Details state
  const [notes, setNotes] = useState('');
  const [extraItems, setExtraItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [photoNames, setPhotoNames] = useState<string[]>([]);

  // Scheduling state
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState<{ time: string; startIso: string } | null>(null);
  const [availableSlots, setAvailableSlots] = useState<Record<string, Slot[]>>({});
  const [slotDurationMinutes, setSlotDurationMinutes] = useState<number | null>(null);

  // Payment state (card-only, charged on submit)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);

  // Multi-item state
  const [items, setItems] = useState<RequestItem[]>([]);

  // Service catalog data
  const [serviceDurations, setServiceDurations] = useState<Record<string, number>>({});
  const [servicePrices, setServicePrices] = useState<Record<string, number>>({});

  // Submission state
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  const reset = useCallback((nextService: ServiceId = 'tv_mount') => {
    setStep(1);
    setService(nextService);
    setTvSize('55"');
    setWallType('Drywall');
    setHasMount('yes');
    setMountType('none');
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
    setPaymentMethods([]);
    setWalletError(null);
    setSelectedPaymentMethodId(null);
    setRequestId(null);
  }, []);

  const resetItemFields = useCallback((nextService: ServiceId = 'tv_mount') => {
    setService(nextService);
    setTvSize('55"');
    setWallType('Drywall');
    setHasMount('yes');
    setMountType('none');
    setAssemblyType('Chair');
    setAssemblyOther('');
    setNotes('');
    setExtraItems([]);
    setNewItem('');
    setPhotoNames([]);
    setStep(1);
  }, []);

  const buildCurrentItem = useCallback(
    (): RequestItem => ({
      service,
      tvSize,
      wallType,
      hasMount,
      mountType: hasMount === 'no' ? mountType : 'none',
      assemblyType,
      assemblyOther,
      extraItems,
      notes,
      photoNames,
    }),
    [service, tvSize, wallType, hasMount, mountType, assemblyType, assemblyOther, extraItems, notes, photoNames],
  );

  // Load service catalog durations and prices
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
      const basePrice = servicePrices[id] ?? 0;
      // Add mount upcharge if user needs a mount
      const mountUpcharge = item.service === 'tv_mount' && item.hasMount === 'no'
        ? MOUNT_UPCHARGES[item.mountType]
        : 0;
      return basePrice + mountUpcharge;
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

  const loadPaymentMethods = useCallback(async () => {
    if (!session) return;
    setWalletLoading(true);
    setWalletError(null);
    const res = await fetch('/api/payments/wallet');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setWalletError(body.error || 'Unable to load saved cards.');
      setPaymentMethods([]);
      setWalletLoading(false);
      return;
    }
    const methods = (body.payment_methods as PaymentMethod[] | undefined) ?? [];
    setPaymentMethods(methods);
    setSelectedPaymentMethodId(methods[0]?.id ?? null);
    setWalletLoading(false);
  }, [session]);

  const onSubmit = useCallback(async () => {
    if (!session?.user || !supabase) {
      setError('Sign in to submit a request.');
      return;
    }
    if (!date || !slot) {
      setError('Select a date and time slot.');
      setStep(2);
      return;
    }

    // Card payment is required
    if (paymentMethods.length === 0) {
      setError('Add a card to continue. Your card will be charged when you submit.');
      return;
    }
    if (!selectedPaymentMethodId) {
      setError('Select a saved card to charge.');
      return;
    }
    if (totalPriceCents <= 0) {
      setError('Total must be greater than $0. Update the request items.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatus(null);

    const itemsToSave: RequestItem[] = [...items, buildCurrentItem()];

    const details = itemsToSave
      .map((item, idx) => {
        const mountTypeLabel = item.mountType === 'static' ? 'Static mount (+$30)'
          : item.mountType === 'full_motion' ? 'Full motion mount (+$70)'
          : null;
        const parts = [
          `Item ${idx + 1}: ${services[item.service].name}`,
          item.service === 'tv_mount' ? `TV size: ${item.tvSize}` : null,
          item.service === 'tv_mount' ? `Wall: ${item.wallType}` : null,
          item.service === 'tv_mount' ? `Mount provided: ${item.hasMount === 'yes' ? 'Yes' : 'No'}` : null,
          item.service === 'tv_mount' && item.hasMount === 'no' && mountTypeLabel ? `Mount type: ${mountTypeLabel}` : null,
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

    const selectedSlots = availableSlots[date] ?? [];
    const selectedIdx = selectedSlots.findIndex((s) => s.startIso === slot?.startIso);
    const chosenSlots = selectedIdx >= 0 ? selectedSlots.slice(selectedIdx, selectedIdx + requiredSlots) : [];
    const slotStartIso = chosenSlots.map((s) => s.startIso).filter(Boolean);

    if (!slotStartIso.length || slotStartIso.length < requiredSlots) {
      setError('Selected time no longer available. Please pick another slot.');
      setSubmitting(false);
      return;
    }

    let newRequestId = requestId;
    if (!newRequestId) {
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
          total_price_cents: totalPriceCents, // Include full price with add-ons
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Failed to submit request.');
        setSubmitting(false);
        return;
      }
      newRequestId = (body.request_id as string | undefined) ?? null;
      setRequestId(newRequestId);
    }

    // Always charge the card
    const chargeRes = await fetch('/api/payments/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount_cents: totalPriceCents,
        currency: 'usd',
        payment_method_id: selectedPaymentMethodId,
        request_id: newRequestId,
      }),
    });
    const chargeBody = await chargeRes.json().catch(() => ({}));
    const chargeStatus = (chargeBody.status as string | undefined) ?? null;
    const paymentIntentId = (chargeBody.payment_intent_id as string | undefined) ?? null;
    if (!chargeRes.ok || chargeStatus !== 'succeeded') {
      setStatus('Request submitted, but your card was not charged.');
      setError(
        chargeBody.error ||
          (chargeStatus
            ? `Card charge incomplete (status: ${chargeStatus}). We will confirm payment manually.`
            : 'Card charge failed. We will confirm payment manually.'),
      );
      setSubmitting(false);
      setStep(5);
      return;
    }
    setStatus(
      `Request submitted and card charged. Payment ID: ${paymentIntentId ?? 'created'}. See you soon!`,
    );

    setSubmitting(false);
    setStep(5);
  }, [
    session,
    supabase,
    date,
    slot,
    paymentMethods,
    selectedPaymentMethodId,
    totalPriceCents,
    items,
    buildCurrentItem,
    requiredMinutes,
    availableSlots,
    requiredSlots,
    requestId,
    service,
  ]);

  return {
    // Modal state
    open,
    setOpen,
    step,
    setStep,
    reset,

    // Service selection
    service,
    setService,
    tvSize,
    setTvSize,
    wallType,
    setWallType,
    hasMount,
    setHasMount,
    mountType,
    setMountType,
    assemblyType,
    setAssemblyType,
    assemblyOther,
    setAssemblyOther,

    // Details
    notes,
    setNotes,
    extraItems,
    setExtraItems,
    newItem,
    setNewItem,
    photoNames,
    setPhotoNames,

    // Scheduling
    date,
    setDate,
    slot,
    setSlot,
    availableSlots,
    setAvailableSlots,
    slotDurationMinutes,
    setSlotDurationMinutes,

    // Payment (card-only)
    paymentMethods,
    walletLoading,
    walletError,
    selectedPaymentMethodId,
    setSelectedPaymentMethodId,
    loadPaymentMethods,

    // Multi-item
    items,
    setItems,
    buildCurrentItem,
    resetItemFields,

    // Computed values
    totalPriceCents,
    totalMinutes,
    requiredMinutes,
    requiredSlots,
    getPriceForItem,
    getMinutesForItem,

    // Submission
    status,
    error,
    setError,
    submitting,
    onSubmit,

    // Session
    session,
    supabase,
  };
}
