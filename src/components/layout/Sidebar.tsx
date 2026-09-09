"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/copilot", label: "AI Copilot" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/inventory", label: "Inventory" },
      { href: "/deadlines", label: "Stock Deadlines" },
      { href: "/alerts", label: "Alerts" },
      { href: "/recommendations", label: "Recommendations" },
    ],
  },
  {
    label: "Transactions",
    items: [
      { href: "/sales", label: "Sales" },
      { href: "/purchases", label: "Purchases" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/products", label: "Products" },
      { href: "/customers", label: "Customers" },
      { href: "/suppliers", label: "Suppliers" },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/import", label: "Import Data" },
      { href: "/reports", label: "Reports" },
      { href: "/audit-log", label: "Audit Log" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface px-3 py-4">
      <div className="mb-6 px-2">
        <p className="text-sm font-semibold text-text">Shoe Xpress</p>
        <p className="text-xs text-text-muted">Inventory Intelligence</p>
      </div>
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="mb-4">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {section.label}
          </p>
          {section.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-2 py-1.5 text-sm ${
                  active ? "bg-primary/10 font-medium text-primary" : "text-text hover:bg-bg"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
