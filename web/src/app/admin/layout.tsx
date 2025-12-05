import Link from "next/link";
import { ReactNode } from "react";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/files", label: "Files" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/activity", label: "Activity" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Admin</p>
        <h2 className="text-lg font-semibold text-slate-900">Control panel</h2>
        <nav className="mt-4 grid gap-1 text-sm font-semibold text-slate-700">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 transition hover:bg-indigo-50 hover:text-indigo-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="grid gap-4">{children}</section>
    </div>
  );
}
