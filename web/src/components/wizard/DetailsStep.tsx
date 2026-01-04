import ItemSummary from './ItemSummary';
import type { RequestItem } from '@/hooks/useRequestWizard';

type DetailsStepProps = {
  notes: string;
  onNotesChange: (notes: string) => void;
  photoNames: string[];
  onPhotoNamesChange: (names: string[]) => void;
  items: RequestItem[];
  currentItem: RequestItem;
  onAddItem: () => void;
};

export default function DetailsStep({
  notes,
  onNotesChange,
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
      <p className="text-xs text-slate-500">We&apos;ll follow up by email/SMS to confirm and gather any photos if needed.</p>
    </div>
  );
}
