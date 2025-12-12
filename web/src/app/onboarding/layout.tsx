import { ReactNode } from "react";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  // Full-screen layout for onboarding, override parent layout
  return (
    <div className="fixed inset-0 z-50 overflow-x-hidden overflow-y-auto bg-slate-50">
      {children}
    </div>
  );
}
