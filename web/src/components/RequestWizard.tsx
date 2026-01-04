'use client';

import { forwardRef, useCallback, useImperativeHandle } from 'react';
import { useRequestWizard, type ServiceId, type Step } from '@/hooks/useRequestWizard';
import WizardProgress from './wizard/WizardProgress';
import RecipientAddressSelector from './wizard/RecipientAddressSelector';
import ServiceSelector from './wizard/ServiceSelector';
import SchedulingPicker from './wizard/SchedulingPicker';
import DetailsStep from './wizard/DetailsStep';
import ReviewStep from './wizard/ReviewStep';

export type RequestWizardHandle = {
  open: (service?: ServiceId) => void;
};

export { services, type ServiceId } from '@/hooks/useRequestWizard';

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

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <WizardProgress currentStep={wizard.step} />

          {wizard.step === 1 && (
            <div className="grid gap-4">
              <RecipientAddressSelector
                serviceRecipient={wizard.serviceRecipient}
                onServiceRecipientChange={wizard.setServiceRecipient}
                serviceAddress={wizard.serviceAddress}
                onServiceAddressChange={wizard.setServiceAddress}
                useProfileAddress={wizard.useProfileAddress}
                onUseProfileAddressChange={wizard.setUseProfileAddress}
              />
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🛠️</span>
                  <p className="text-sm font-semibold text-slate-900">What service do you need?</p>
                </div>
                <ServiceSelector
                  service={wizard.service}
                  onServiceChange={wizard.setService}
                  tvSize={wizard.tvSize}
                  onTvSizeChange={wizard.setTvSize}
                  wallType={wizard.wallType}
                  onWallTypeChange={wizard.setWallType}
                  hasMount={wizard.hasMount}
                  onHasMountChange={wizard.setHasMount}
                  mountType={wizard.mountType}
                  onMountTypeChange={wizard.setMountType}
                  assemblyType={wizard.assemblyType}
                  onAssemblyTypeChange={wizard.setAssemblyType}
                  assemblyOther={wizard.assemblyOther}
                  onAssemblyOtherChange={wizard.setAssemblyOther}
                  electricalType={wizard.electricalType}
                  onElectricalTypeChange={wizard.setElectricalType}
                  electricalOther={wizard.electricalOther}
                  onElectricalOtherChange={wizard.setElectricalOther}
                  punchTasks={wizard.punchTasks}
                  onPunchTasksChange={wizard.setPunchTasks}
                  newPunchTask={wizard.newPunchTask}
                  onNewPunchTaskChange={wizard.setNewPunchTask}
                  selectedCatalogItems={wizard.catalogItems}
                  onCatalogItemsChange={wizard.setCatalogItems}
                />
              </div>
            </div>
          )}

          {wizard.step === 2 && (
            <SchedulingPicker
              date={wizard.date}
              onDateChange={wizard.setDate}
              slot={wizard.slot}
              onSlotChange={wizard.setSlot}
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
              subtotalCents={wizard.subtotalCents}
              urgencyFeeCents={wizard.urgencyFeeCents}
              totalPriceCents={wizard.totalPriceCents}
              requiredMinutes={wizard.requiredMinutes}
              date={wizard.date}
              slot={wizard.slot}
              paymentMethods={wizard.paymentMethods}
              selectedPaymentMethodId={wizard.selectedPaymentMethodId}
              onSelectedPaymentMethodIdChange={wizard.setSelectedPaymentMethodId}
              walletLoading={wizard.walletLoading}
              walletError={wizard.walletError}
              onLoadPaymentMethods={wizard.loadPaymentMethods}
              isLoggedIn={!!wizard.session}
            />
          )}

          {wizard.step === 5 && (
            <div className="grid gap-4 rounded-xl border border-green-200 bg-green-50 p-5 text-center">
              <div className="flex flex-col items-center gap-2">
                <span className="text-4xl">✅</span>
                <p className="text-lg font-semibold text-green-800">Request Submitted!</p>
                <p className="text-sm text-green-700">Your request is now visible to our handymen.</p>
              </div>
              <div className="rounded-lg border border-green-300 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Reference Number</p>
                <p className="mt-1 font-mono text-xl font-bold text-slate-900">{wizard.status}</p>
              </div>
              <div className="grid gap-1 text-sm text-green-800">
                <p><strong>Preferred Date:</strong> {wizard.date}</p>
                <p><strong>Preferred Time:</strong> {wizard.slot?.time}</p>
                <p><strong>Estimated Total:</strong> {(wizard.totalPriceCents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">
                  <strong>Next step:</strong> A handyman will accept your request. Your card will be charged once confirmed.
                  You can cancel for free until then.
                </p>
              </div>
              <button
                onClick={() => wizard.setOpen(false)}
                className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800"
              >
                Done
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
                  disabled={wizard.step === 2 && !wizard.slot}
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
