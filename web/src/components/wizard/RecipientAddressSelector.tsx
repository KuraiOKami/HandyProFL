import { SERVICE_RECIPIENTS, type ServiceRecipient, type ServiceAddress } from '@/hooks/useRequestWizard';
import { US_STATES } from '@/lib/usStates';

type RecipientAddressSelectorProps = {
  serviceRecipient: ServiceRecipient;
  onServiceRecipientChange: (recipient: ServiceRecipient) => void;
  serviceAddress: ServiceAddress;
  onServiceAddressChange: (address: ServiceAddress) => void;
  useProfileAddress: boolean;
  onUseProfileAddressChange: (use: boolean) => void;
};

export default function RecipientAddressSelector({
  serviceRecipient,
  onServiceRecipientChange,
  serviceAddress,
  onServiceAddressChange,
  useProfileAddress,
  onUseProfileAddressChange,
}: RecipientAddressSelectorProps) {
  const showAddressFields = !useProfileAddress || serviceRecipient !== 'myself';

  return (
    <div className="grid gap-4">
      {/* Who is this for? */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">👤</span>
            <p className="text-sm font-semibold text-slate-900">Who is this service for?</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SERVICE_RECIPIENTS.map((recipient) => (
              <button
                key={recipient.value}
                onClick={() => {
                  onServiceRecipientChange(recipient.value);
                  // If switching away from myself, show address fields
                  if (recipient.value !== 'myself') {
                    onUseProfileAddressChange(false);
                  }
                }}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition ${
                  serviceRecipient === recipient.value
                    ? 'border-indigo-600 bg-white shadow-sm'
                    : 'border-slate-200 bg-white hover:border-indigo-300'
                }`}
              >
                <span className="text-sm font-semibold text-slate-900">{recipient.label}</span>
                <span className="text-xs text-slate-500 leading-tight">{recipient.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Service Address */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <p className="text-sm font-semibold text-slate-900">Service Location</p>
          </div>

          {serviceRecipient === 'myself' && (
            <div className="flex gap-2">
              <button
                onClick={() => onUseProfileAddressChange(true)}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                  useProfileAddress
                    ? 'border-indigo-600 bg-white text-indigo-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'
                }`}
              >
                Use my saved address
              </button>
              <button
                onClick={() => onUseProfileAddressChange(false)}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                  !useProfileAddress
                    ? 'border-indigo-600 bg-white text-indigo-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'
                }`}
              >
                Enter a different address
              </button>
            </div>
          )}

          {serviceRecipient !== 'myself' && (
            <p className="text-xs text-slate-600">
              Enter the address where the service will be performed.
            </p>
          )}

          {showAddressFields && (
            <div className="grid gap-3">
              <input
                type="text"
                value={serviceAddress.street}
                onChange={(e) => onServiceAddressChange({ ...serviceAddress, street: e.target.value })}
                placeholder="Street address"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <div className="grid grid-cols-6 gap-2">
                <input
                  type="text"
                  value={serviceAddress.city}
                  onChange={(e) => onServiceAddressChange({ ...serviceAddress, city: e.target.value })}
                  placeholder="City"
                  className="col-span-3 rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <select
                  value={serviceAddress.state}
                  onChange={(e) => onServiceAddressChange({ ...serviceAddress, state: e.target.value })}
                  className="col-span-1 rounded-lg border border-slate-300 px-2 py-2.5 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  {US_STATES.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.code}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={serviceAddress.postalCode}
                  onChange={(e) => onServiceAddressChange({ ...serviceAddress, postalCode: e.target.value })}
                  placeholder="ZIP"
                  className="col-span-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
          )}

          {serviceRecipient === 'myself' && useProfileAddress && (
            <p className="text-xs text-slate-500">
              We&apos;ll use the address from your account profile.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
