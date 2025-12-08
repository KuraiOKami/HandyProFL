'use client';

import { useCallback, useEffect } from 'react';
import { useRequestWizard, services, type RequestItem, type Step } from '@/hooks/useRequestWizard';
import WizardProgress from './wizard/WizardProgress';
import ServiceSelector from './wizard/ServiceSelector';
import SchedulingPicker from './wizard/SchedulingPicker';
import PaymentMethodSelector from './wizard/PaymentMethodSelector';

const DISPLAY_TIME_ZONE = 'America/New_York';

export default function RequestWizardV2() {
  const wizard = useRequestWizard();

  // Load slots when date changes
  const handleLoadSlots = useCallback(
    async (selectedDate: string) => {
      if (!wizard.supabase || !selectedDate) return;

      const dayStartLocal = `${selectedDate}T00:00:00`;
      const dayEndLocal = `${selectedDate}T23:59:59`;

      const { data, error } = await wizard.supabase
        .from('available_slots')
        .select('slot_start, slot_end, is_booked')
        .gte('slot_start', dayStartLocal)
        .lte('slot_start', dayEndLocal)
        .order('slot_start', { ascending: true });

      if (error) {
        console.error('Error loading slots', error.message);
        return;
      }

      if (data && data.length) {
        const durationMs = new Date(data[0].slot_end).getTime() - new Date(data[0].slot_start).getTime();
        wizard.setSlotDurationMinutes(Math.max(1, Math.round(durationMs / 60000)));
      } else {
        wizard.setSlotDurationMinutes(30);
      }

      const normalized = (data ?? [])
        .map((row) => {
          const start = new Date(row.slot_start);
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: DISPLAY_TIME_ZONE,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).formatToParts(start);
          const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
          const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
          const withinServiceHours = hour >= 9 && (hour < 19 || (hour === 19 && minute === 0));
          if (!withinServiceHours) return null;

          const time = start.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: DISPLAY_TIME_ZONE,
          });
          return { time, available: !row.is_booked, startIso: row.slot_start };
        })
        .filter(Boolean) as { time: string; available: boolean; startIso: string }[];

      wizard.setAvailableSlots((prev) => ({ ...prev, [selectedDate]: normalized.length ? normalized : [] }));
    },
    [wizard],
  );

  // Load payment methods when reaching step 4
  useEffect(() => {
    if (wizard.step === 4 && wizard.session) {
      wizard.loadPaymentMethods();
    }
  }, [wizard]);

  return (
    <div className="grid gap-4">
      <button
        onClick={() => {
          wizard.setOpen(true);
          wizard.reset();
        }}
        className="inline-flex items-center justify-center rounded-lg bg-indigo-700 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-800"
      >
        Start a request
      </button>

      {wizard.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Request</p>
                <h2 className="text-xl font-semibold text-slate-900">Book a handyman visit</h2>
              </div>
              <button
                onClick={() => wizard.setOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700 hover:border-indigo-600 hover:text-indigo-700"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5">
              <WizardProgress currentStep={wizard.step} />

              {wizard.step === 1 && (
                <ServiceSelector
                  service={wizard.service}
                  onServiceChange={wizard.setService}
                  tvSize={wizard.tvSize}
                  onTvSizeChange={wizard.setTvSize}
                  wallType={wizard.wallType}
                  onWallTypeChange={wizard.setWallType}
                  hasMount={wizard.hasMount}
                  onHasMountChange={wizard.setHasMount}
                  assemblyType={wizard.assemblyType}
                  onAssemblyTypeChange={wizard.setAssemblyType}
                  assemblyOther={wizard.assemblyOther}
                  onAssemblyOtherChange={wizard.setAssemblyOther}
                />
              )}

              {wizard.step === 2 && (
                <SchedulingPicker
                  date={wizard.date}
                  onDateChange={wizard.setDate}
                  slot={wizard.slot}
                  onSlotChange={wizard.setSlot}
                  availableSlots={wizard.availableSlots}
                  onLoadSlots={handleLoadSlots}
                  slotDurationMinutes={wizard.slotDurationMinutes}
                  requiredSlots={wizard.requiredSlots}
                />
              )}

              {wizard.step === 3 && (
                <DetailsStep
                  notes={wizard.notes}
                  onNotesChange={wizard.setNotes}
                  extraItems={wizard.extraItems}
                  onExtraItemsChange={wizard.setExtraItems}
                  newItem={wizard.newItem}
                  onNewItemChange={wizard.setNewItem}
                  photoNames={wizard.photoNames}
                  onPhotoNamesChange={wizard.setPhotoNames}
                  items={wizard.items}
                  currentItem={wizard.buildCurrentItem()}
                  onAddItem={() => {
                    wizard.setItems((prev) => [...prev, wizard.buildCurrentItem()]);
                    wizard.resetItemFields();
                  }}
                />
              )}

              {wizard.step === 4 && (
                <ReviewStep
                  items={[...wizard.items, wizard.buildCurrentItem()]}
                  getPriceForItem={wizard.getPriceForItem}
                  totalPriceCents={wizard.totalPriceCents}
                  requiredMinutes={wizard.requiredMinutes}
                  date={wizard.date}
                  slot={wizard.slot}
                  payMethod={wizard.payMethod}
                  onPayMethodChange={wizard.setPayMethod}
                  paymentMethods={wizard.paymentMethods}
                  selectedPaymentMethodId={wizard.selectedPaymentMethodId}
                  onSelectPaymentMethod={wizard.setSelectedPaymentMethodId}
                  walletLoading={wizard.walletLoading}
                  walletError={wizard.walletError}
                  onRefreshCards={wizard.loadPaymentMethods}
                />
              )}

              {wizard.step === 5 && (
                <div className="grid gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-semibold text-green-800">All set</p>
                  <p className="text-sm text-green-900">{wizard.status}</p>
                  <button
                    onClick={() => wizard.setOpen(false)}
                    className="inline-flex w-fit items-center justify-center rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800"
                  >
                    Close
                  </button>
                </div>
              )}

              {wizard.error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{wizard.error}</p>}

              {wizard.step < 5 && (
                <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                  <div className="text-sm text-slate-600">
                    {wizard.step === 1 && 'Choose the service and options.'}
                    {wizard.step === 2 && 'Select a date and a time slot.'}
                    {wizard.step === 3 && 'Add any extra context.'}
                    {wizard.step === 4 && 'Review subtotal and payment preference.'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => (wizard.step === 1 ? wizard.setOpen(false) : wizard.setStep((prev) => (prev - 1) as Step))}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700"
                    >
                      {wizard.step === 1 ? 'Cancel' : 'Back'}
                    </button>
                    {wizard.step < 4 && (
                      <button
                        onClick={() => wizard.setStep((prev) => (prev + 1) as Step)}
                        className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        disabled={wizard.step === 2 && (!wizard.slot || Object.keys(wizard.availableSlots).length === 0)}
                      >
                        Continue
                      </button>
                    )}
                    {wizard.step === 4 && (
                      <button
                        onClick={wizard.onSubmit}
                        disabled={wizard.submitting}
                        className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {wizard.submitting ? 'Submitting...' : 'Submit request'}
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

// DetailsStep Component
type DetailsStepProps = {
  notes: string;
  onNotesChange: (notes: string) => void;
  extraItems: string[];
  onExtraItemsChange: (items: string[]) => void;
  newItem: string;
  onNewItemChange: (item: string) => void;
  photoNames: string[];
  onPhotoNamesChange: (names: string[]) => void;
  items: RequestItem[];
  currentItem: RequestItem;
  onAddItem: () => void;
};

function DetailsStep({
  notes,
  onNotesChange,
  extraItems,
  onExtraItemsChange,
  newItem,
  onNewItemChange,
  photoNames,
  onPhotoNamesChange,
  items,
  currentItem,
  onAddItem,
}: DetailsStepProps) {
  const allItems = [...items, currentItem];

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-900">Details</p>
      <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Extra items</p>
          <button
            onClick={() => {
              if (!newItem.trim()) return;
              onExtraItemsChange([...extraItems, newItem.trim()]);
              onNewItemChange('');
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
          onChange={(e) => onNewItemChange(e.target.value)}
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
                onClick={() => onExtraItemsChange(extraItems.filter((_, i) => i !== idx))}
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
        onChange={(e) => onNotesChange(e.target.value)}
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
            onPhotoNamesChange(files.map((f) => f.name));
          }}
          className="text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-800 hover:file:border-indigo-600 hover:file:text-indigo-700"
        />
        {photoNames.length > 0 && <p className="text-xs text-slate-600">Attached: {photoNames.join(', ')}</p>}
        <p className="text-xs text-slate-500">Upload support is coming soon—files are noted with your request for now.</p>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Items in this request</p>
          <span className="text-xs font-semibold text-indigo-700">
            {allItems.length} {allItems.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="grid gap-2">
          {allItems.map((item, idx) => (
            <ItemSummary key={idx} item={item} index={idx} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddItem}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700"
          >
            Add this item & start another
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500">We'll follow up by email/SMS to confirm and gather any photos if needed.</p>
    </div>
  );
}

// ReviewStep Component
type PaymentMethodType = {
  id: string;
  brand?: string | null;
  last4?: string | null;
  exp_month?: number | null;
  exp_year?: number | null;
};

type ReviewStepProps = {
  items: RequestItem[];
  getPriceForItem: (item: RequestItem) => number;
  totalPriceCents: number;
  requiredMinutes: number;
  date: string;
  slot: { time: string; startIso: string } | null;
  payMethod: 'pay_later' | 'card_on_file';
  onPayMethodChange: (method: 'pay_later' | 'card_on_file') => void;
  paymentMethods: PaymentMethodType[];
  selectedPaymentMethodId: string | null;
  onSelectPaymentMethod: (id: string) => void;
  walletLoading: boolean;
  walletError: string | null;
  onRefreshCards: () => void;
};

function ReviewStep({
  items,
  getPriceForItem,
  totalPriceCents,
  requiredMinutes,
  date,
  slot,
  payMethod,
  onPayMethodChange,
  paymentMethods,
  selectedPaymentMethodId,
  onSelectPaymentMethod,
  walletLoading,
  walletError,
  onRefreshCards,
}: ReviewStepProps) {
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-900">Review & payment</p>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Items</p>
          <span className="text-xs font-semibold text-indigo-700">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="grid gap-2">
          {items.map((item, idx) => (
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
              {item.extraItems.length > 0 && <p className="text-xs text-slate-500">Extras: {item.extraItems.join(', ')}</p>}
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
      <PaymentMethodSelector
        payMethod={payMethod}
        onPayMethodChange={onPayMethodChange}
        paymentMethods={paymentMethods}
        selectedPaymentMethodId={selectedPaymentMethodId}
        onSelectPaymentMethod={onSelectPaymentMethod}
        walletLoading={walletLoading}
        walletError={walletError}
        onRefreshCards={onRefreshCards}
      />
    </div>
  );
}

// ItemSummary Component
function ItemSummary({ item, index }: { item: RequestItem; index: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
          Item {index + 1}
        </span>
        <span className="font-semibold">{services[item.service].name}</span>
      </div>
      <p className="text-xs text-slate-600">
        {item.service === 'tv_mount'
          ? `TV ${item.tvSize} | ${item.wallType} | Mount: ${item.hasMount === 'yes' ? 'Yes' : 'No'}`
          : item.service === 'assembly'
            ? `Assembly: ${item.assemblyType}${item.assemblyType === 'Other' && item.assemblyOther ? ` (${item.assemblyOther})` : ''}`
            : 'Standard service'}
      </p>
      {item.extraItems.length > 0 && <p className="text-xs text-slate-500">Extras: {item.extraItems.join(', ')}</p>}
      {item.photoNames.length > 0 && <p className="text-xs text-slate-500">Photos: {item.photoNames.join(', ')}</p>}
      {item.notes && <p className="text-xs text-slate-500">Notes: {item.notes}</p>}
    </div>
  );
}
