import type { Step } from '@/hooks/useRequestWizard';

type WizardProgressProps = {
  currentStep: Step;
};

export default function WizardProgress({ currentStep }: WizardProgressProps) {
  const steps = [
    { id: 1 as Step, label: 'Service' },
    { id: 2 as Step, label: 'Schedule' },
    { id: 3 as Step, label: 'Details' },
    { id: 4 as Step, label: 'Review' },
    { id: 5 as Step, label: 'Done' },
  ];

  return (
    <div className="grid grid-cols-5 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
      {steps.map((s) => (
        <div
          key={s.id}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
            currentStep === s.id ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
              currentStep >= s.id ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
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
