import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // Full-width layout for admin dashboard with sidebar
  // Override the parent layout's max-width and padding
  return (
    <div className="fixed inset-0 top-0 z-50 overflow-hidden bg-slate-50">
      {children}
    </div>
  );
}
