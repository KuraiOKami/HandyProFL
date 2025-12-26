import { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  // Full-width layout for client dashboard with sidebar
  // Override the parent layout's max-width and padding
  return (
    <div className="fixed inset-0 z-50 overflow-x-hidden overflow-y-auto bg-slate-50">
      {children}
    </div>
  );
}
