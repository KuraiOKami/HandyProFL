'use client';

import { useState, useEffect, useMemo } from 'react';
import { services, type ServiceId, type MountType, MOUNT_UPCHARGES } from '@/hooks/useRequestWizard';
import { getSupabaseClient } from '@/lib/supabaseClient';

type ServiceCatalogItem = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price_cents: number;
  base_minutes: number;
};

type ServiceSelectorProps = {
  service: ServiceId;
  onServiceChange: (service: ServiceId) => void;
  tvSize: string;
  onTvSizeChange: (size: string) => void;
  wallType: string;
  onWallTypeChange: (type: string) => void;
  hasMount: 'yes' | 'no';
  onHasMountChange: (value: 'yes' | 'no') => void;
  mountType: MountType;
  onMountTypeChange: (type: MountType) => void;
  assemblyType: string;
  onAssemblyTypeChange: (type: string) => void;
  assemblyOther: string;
  onAssemblyOtherChange: (value: string) => void;
  electricalType: string;
  onElectricalTypeChange: (type: string) => void;
  electricalOther: string;
  onElectricalOtherChange: (value: string) => void;
  punchTasks: string[];
  onPunchTasksChange: (tasks: string[]) => void;
  newPunchTask: string;
  onNewPunchTaskChange: (value: string) => void;
};

const formatUpcharge = (cents: number) => cents > 0 ? `+$${cents / 100}` : '';
const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;
const formatDuration = (minutes: number) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs && mins) return `${hrs}h ${mins}m`;
  if (hrs) return `${hrs}h`;
  return `${mins}m`;
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
  mountType,
  onMountTypeChange,
  assemblyType,
  onAssemblyTypeChange,
  assemblyOther,
  onAssemblyOtherChange,
  electricalType,
  onElectricalTypeChange,
  electricalOther,
  onElectricalOtherChange,
  punchTasks,
  onPunchTasksChange,
  newPunchTask,
  onNewPunchTaskChange,
}: ServiceSelectorProps) {
  const supabase = getSupabaseClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [catalogItems, setCatalogItems] = useState<ServiceCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Load service catalog when search is opened
  useEffect(() => {
    const loadCatalog = async () => {
      if (!supabase || !showSearch || catalogItems.length > 0) return;

      setLoadingCatalog(true);
      try {
        const { data, error } = await supabase
          .from('service_catalog')
          .select('id, name, category, description, price_cents, base_minutes')
          .order('category', { ascending: true })
          .order('name', { ascending: true });

        if (!error && data) {
          setCatalogItems(data);
        }
      } catch (err) {
        console.error('Failed to load service catalog:', err);
      } finally {
        setLoadingCatalog(false);
      }
    };

    loadCatalog();
  }, [supabase, showSearch, catalogItems.length]);

  // Filter catalog items based on search query
  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return catalogItems;
    const query = searchQuery.toLowerCase();
    return catalogItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query))
    );
  }, [catalogItems, searchQuery]);

  // Group by category
  const groupedCatalog = useMemo(() => {
    return filteredCatalog.reduce<Record<string, ServiceCatalogItem[]>>((acc, item) => {
      acc[item.category] = acc[item.category] ? [...acc[item.category], item] : [item];
      return acc;
    }, {});
  }, [filteredCatalog]);

  const handleAddPunchTask = () => {
    if (newPunchTask.trim()) {
      onPunchTasksChange([...punchTasks, newPunchTask.trim()]);
      onNewPunchTaskChange('');
    }
  };

  const handleRemovePunchTask = (index: number) => {
    onPunchTasksChange(punchTasks.filter((_, i) => i !== index));
  };

  const handleCatalogItemSelect = (item: ServiceCatalogItem) => {
    // Map catalog items to punch list (most flexible option)
    onServiceChange('punch');
    onPunchTasksChange([...punchTasks, `${item.name} - ${formatPrice(item.price_cents)}`]);
    setSearchQuery('');
    setShowSearch(false);
  };

  return (
    <div className="grid gap-3 sm:gap-4">
      {/* Search Bar */}
      <div className="col-span-2">
        <button
          type="button"
          onClick={() => setShowSearch(!showSearch)}
          className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-500 transition hover:border-indigo-300 hover:bg-slate-50"
        >
          <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>Search all services...</span>
        </button>
      </div>

      {/* Search Panel */}
      {showSearch && (
        <div className="col-span-2 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for any service..."
              autoFocus
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowSearch(false)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Close
            </button>
          </div>

          {loadingCatalog && (
            <div className="py-4 text-center text-sm text-slate-500">
              Loading services...
            </div>
          )}

          {!loadingCatalog && filteredCatalog.length === 0 && searchQuery && (
            <div className="py-4 text-center">
              <p className="text-sm text-slate-600">No services found for &quot;{searchQuery}&quot;</p>
              <p className="mt-1 text-xs text-slate-500">Try a different search or select from the main categories below.</p>
            </div>
          )}

          {!loadingCatalog && Object.entries(groupedCatalog).length > 0 && (
            <div className="max-h-64 space-y-4 overflow-y-auto">
              {Object.entries(groupedCatalog).map(([category, items]) => (
                <div key={category}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">{category}</p>
                  <div className="grid gap-2">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleCatalogItemSelect(item)}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-300 hover:shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900">{item.name}</p>
                          {item.description && (
                            <p className="mt-0.5 truncate text-xs text-slate-500">{item.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{formatPrice(item.price_cents)}</p>
                          <p className="text-xs text-slate-500">{formatDuration(item.base_minutes)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loadingCatalog && catalogItems.length === 0 && !searchQuery && (
            <div className="py-4 text-center text-sm text-slate-500">
              Service catalog not available. Select from the categories below.
            </div>
          )}
        </div>
      )}

      {/* Main Service Buttons */}
      <div className="col-span-2 grid grid-cols-2 gap-3 sm:gap-4">
        {Object.entries(services).map(([id, svc]) => (
          <button
            key={id}
            onClick={() => onServiceChange(id as ServiceId)}
            className={`flex h-full flex-col items-start gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl border px-2.5 py-2.5 sm:px-4 sm:py-4 text-left transition ${
              service === id
                ? 'border-indigo-600 bg-indigo-50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-indigo-200'
            }`}
          >
            <span className="text-xl sm:text-2xl">{svc.icon}</span>
            <div className="grid gap-0.5 sm:gap-1">
              <span className="text-sm sm:text-base font-semibold text-slate-900 leading-tight">{svc.name}</span>
              <span className="text-xs sm:text-sm text-slate-600 leading-snug">{svc.description}</span>
            </div>
          </button>
        ))}
      </div>

      {service === 'tv_mount' && (
        <div className="col-span-2 md:col-span-2 grid gap-3 rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <div className="grid gap-2">
            <FieldLabel>TV size</FieldLabel>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {services.tv_mount.options?.sizes?.map((size) => (
                <Chip key={size} selected={tvSize === size} onClick={() => onTvSizeChange(size)}>
                  {size}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <FieldLabel>Wall type</FieldLabel>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {services.tv_mount.options?.wallTypes?.map((type) => (
                <Chip key={type} selected={wallType === type} onClick={() => onWallTypeChange(type)}>
                  {type}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <FieldLabel>Do you have a mount?</FieldLabel>
            <div className="flex gap-1.5 sm:gap-2">
              <Chip selected={hasMount === 'yes'} onClick={() => onHasMountChange('yes')}>
                Yes, I have one
              </Chip>
              <Chip selected={hasMount === 'no'} onClick={() => onHasMountChange('no')}>
                No, I need one
              </Chip>
            </div>
          </div>

          {/* Mount type selection when user doesn't have a mount */}
          {hasMount === 'no' && (
            <div className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <FieldLabel>Select mount type</FieldLabel>
              <p className="text-xs text-amber-800">We&apos;ll bring and install a mount for you.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <MountOption
                  selected={mountType === 'static'}
                  onClick={() => onMountTypeChange('static')}
                  title="Static/Fixed Mount"
                  description="Flush to wall, no movement"
                  upcharge={MOUNT_UPCHARGES.static}
                />
                <MountOption
                  selected={mountType === 'full_motion'}
                  onClick={() => onMountTypeChange('full_motion')}
                  title="Full Motion Mount"
                  description="Swivel, tilt, and extend"
                  upcharge={MOUNT_UPCHARGES.full_motion}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {service === 'assembly' && (
        <div className="col-span-2 md:col-span-2 grid gap-3 rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <div className="grid gap-2">
            <FieldLabel>What are we assembling?</FieldLabel>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="e.g., custom cabinet, gym equipment"
              />
            </label>
          )}
        </div>
      )}

      {service === 'electrical' && (
        <div className="col-span-2 md:col-span-2 grid gap-3 rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <div className="grid gap-2">
            <FieldLabel>What type of fixture?</FieldLabel>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {services.electrical.options?.electricalTypes?.map((type) => (
                <Chip key={type} selected={electricalType === type} onClick={() => onElectricalTypeChange(type)}>
                  {type}
                </Chip>
              ))}
            </div>
          </div>
          {electricalType === 'Other' && (
            <label className="grid gap-1 text-sm text-slate-800">
              Describe the fixture
              <input
                type="text"
                value={electricalOther}
                onChange={(e) => onElectricalOtherChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="e.g., chandelier, under-cabinet lighting"
              />
            </label>
          )}
        </div>
      )}

      {service === 'punch' && (
        <div className="col-span-2 md:col-span-2 grid gap-3 rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <div className="grid gap-2">
            <FieldLabel>Create your task list</FieldLabel>
            <p className="text-xs text-slate-600">Add the small jobs you need done. 2-hour minimum.</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPunchTask}
                onChange={(e) => onNewPunchTaskChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPunchTask())}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 shadow-inner shadow-slate-100 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="e.g., Hang picture frames, fix door handle"
              />
              <button
                type="button"
                onClick={handleAddPunchTask}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Add
              </button>
            </div>
          </div>
          {punchTasks.length > 0 && (
            <div className="grid gap-2">
              <FieldLabel>Your tasks ({punchTasks.length})</FieldLabel>
              <ul className="grid gap-1.5">
                {punchTasks.map((task, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                  >
                    <span className="text-sm text-slate-800">{task}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePunchTask(idx)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {punchTasks.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
              No tasks yet. Add your first task above.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MountOption({
  selected,
  onClick,
  title,
  description,
  upcharge,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  upcharge: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition ${
        selected
          ? 'border-indigo-600 bg-white shadow-sm'
          : 'border-slate-200 bg-white hover:border-indigo-300'
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <span className="text-xs font-semibold text-indigo-700">{formatUpcharge(upcharge)}</span>
      </div>
      <span className="text-xs text-slate-600">{description}</span>
    </button>
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
      className={`rounded-full border px-3 py-2 sm:py-1.5 text-xs font-semibold transition min-h-[36px] sm:min-h-0 ${
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
