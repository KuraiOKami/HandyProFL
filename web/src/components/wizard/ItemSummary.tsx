import { type ReactNode } from 'react';
import { services, type RequestItem } from '@/hooks/useRequestWizard';

type ItemSummaryProps = {
  item: RequestItem;
  index: number;
  meta?: ReactNode;
  bordered?: boolean;
};

export default function ItemSummary({ item, index, meta, bordered = true }: ItemSummaryProps) {
  return (
    <div
      className={`text-sm text-slate-800 ${bordered ? 'rounded-lg border border-slate-200 bg-white p-3' : 'p-1'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
            Item {index + 1}
          </span>
          <span className="font-semibold">{services[item.service].name}</span>
        </div>
        {meta}
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
      {item.photoNames.length > 0 && <p className="text-xs text-slate-500">Photos: {item.photoNames.join(', ')}</p>}
      {item.notes && <p className="text-xs text-slate-500">Notes: {item.notes}</p>}
    </div>
  );
}
