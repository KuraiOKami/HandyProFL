import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="grid gap-6">{children}</div>;
}
