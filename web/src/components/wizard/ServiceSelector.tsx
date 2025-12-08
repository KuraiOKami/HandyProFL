import { services, type ServiceId } from '@/hooks/useRequestWizard';

type ServiceSelectorProps = {
  service: ServiceId;
  onServiceChange: (service: ServiceId) => void;
  tvSize: string;
  onTvSizeChange: (size: string) => void;
  wallType: string;
  onWallTypeChange: (type: string) => void;
  hasMount: 'yes' | 'no';
  onHasMountChange: (value: 'yes' | 'no') => void;
  assemblyType: string;
  onAssemblyTypeChange: (type: string) => void;
  assemblyOther: string;
  onAssemblyOtherChange: (value: string) => void;
};

export default function ServiceSelector({
  service,
  onServiceChange,
  tvSize,
  onTvSizeChange,
  wallType,
  onWallTypeChange,
  hasMount,
  onHasMountChange,
  assemblyType,
  onAssemblyTypeChange,
  assemblyOther,
  onAssemblyOtherChange,
}: ServiceSelectorProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Object.entries(services).map(([id, svc]) => (
        <button
          key={id}
          onClick={() => onServiceChange(id as ServiceId)}
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
                <Chip key={size} selected={tvSize === size} onClick={() => onTvSizeChange(size)}>
                  {size}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <FieldLabel>Wall type</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {services.tv_mount.options?.wallTypes?.map((type) => (
                <Chip key={type} selected={wallType === type} onClick={() => onWallTypeChange(type)}>
                  {type}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FieldLabel>Mount provided?</FieldLabel>
            <div className="flex gap-2">
              <Chip selected={hasMount === 'yes'} onClick={() => onHasMountChange('yes')}>
                Yes
              </Chip>
              <Chip selected={hasMount === 'no'} onClick={() => onHasMountChange('no')}>
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
                <Chip key={type} selected={assemblyType === type} onClick={() => onAssemblyTypeChange(type)}>
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
                onChange={(e) => onAssemblyOtherChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="e.g., custom cabinet, gym equipment"
              />
            </label>
          )}
        </div>
      )}
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
