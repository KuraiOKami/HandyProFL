'use client';

import { forwardRef, useCallback, useImperativeHandle } from 'react';
import { useRequestWizard, type ServiceId, type Step } from '@/hooks/useRequestWizard';
import WizardProgress from './wizard/WizardProgress';
import ServiceSelector from './wizard/ServiceSelector';
import SchedulingPicker from './wizard/SchedulingPicker';
import DetailsStep from './wizard/DetailsStep';
import ReviewStep from './wizard/ReviewStep';

export type RequestWizardHandle = {
  open: (service?: ServiceId) => void;
};

export { services, type ServiceId } from '@/hooks/useRequestWizard';

const DISPLAY_TIME_ZONE = 'America/New_York';

const RequestWizard = forwardRef<RequestWizardHandle>((_props, ref) => {
  const wizard = useRequestWizard();

  const openWizard = useCallback(
    (svc?: ServiceId) => {
      wizard.reset(svc ?? 'tv_mount');
      wizard.setOpen(true);
    },
    [wizard],
  );

  useImperativeHandle(ref, () => ({ open: openWizard }), [openWizard]);

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

  const handleAddItem = useCallback(() => {
    wizard.setItems((prev) => [...prev, wizard.buildCurrentItem()]);
    wizard.resetItemFields();
  }, [wizard]);

  if (!wizard.open) return null;

  const itemsForReview = [...wizard.items, wizard.buildCurrentItem()];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-0 sm:p-4">
      <div className="relative flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl ring-1 ring-slate-200 sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Request</p>
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Book a handyman visit</h2>
          </div>
          <button
            onClick={() => wizard.setOpen(false)}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-600 hover:text-indigo-700 sm:text-sm"
          >
            Close
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
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
              photoNames={wizard.photoNames}
              onPhotoNamesChange={wizard.setPhotoNames}
              items={wizard.items}
              currentItem={wizard.buildCurrentItem()}
              onAddItem={handleAddItem}
            />
          )}

          {wizard.step === 4 && (
            <ReviewStep
              items={itemsForReview}
              getPriceForItem={wizard.getPriceForItem}
              totalPriceCents={wizard.totalPriceCents}
              requiredMinutes={wizard.requiredMinutes}
              date={wizard.date}
              slot={wizard.slot}
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
        </div>

        {wizard.step < 5 && (
          <div className="flex flex-shrink-0 flex-col items-start justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:px-6 sm:py-4">
            <div className="text-xs text-slate-600 sm:text-sm">
              {wizard.step === 1 && 'Choose the service and options.'}
              {wizard.step === 2 && 'Select a date and a time slot.'}
              {wizard.step === 3 && 'Add any extra context.'}
              {wizard.step === 4 && 'Review subtotal and payment preference.'}
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <button
                onClick={() =>
                  wizard.step === 1 ? wizard.setOpen(false) : wizard.setStep((prev) => (prev - 1) as Step)
                }
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:border-indigo-600 hover:text-indigo-700 sm:flex-initial"
              >
                {wizard.step === 1 ? 'Cancel' : 'Back'}
              </button>
              {wizard.step < 4 && (
                <button
                  onClick={() => wizard.setStep((prev) => (prev + 1) as Step)}
                  className="flex-1 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-initial"
                  disabled={wizard.step === 2 && (!wizard.slot || Object.keys(wizard.availableSlots).length === 0)}
                >
                  Continue
                </button>
              )}
              {wizard.step === 4 && (
                <button
                  onClick={wizard.onSubmit}
                  disabled={wizard.submitting}
                  className="flex-1 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-initial"
                >
                  {wizard.submitting ? 'Submitting...' : 'Submit request'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

RequestWizard.displayName = 'RequestWizard';

export default RequestWizard;
