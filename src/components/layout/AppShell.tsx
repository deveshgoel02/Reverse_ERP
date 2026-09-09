"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

// Below md, the sidebar is an off-canvas drawer (hidden by default, toggled
// from the Topbar's menu button); at md and up it's the always-visible
// column the desktop layout has always had. State lives here, one level
// above both, since a hamburger in Topbar has to open a drawer in Sidebar.
export function AppShell({
  businessName,
  userName,
  role,
  children,
}: {
  businessName: string;
  userName: string;
  role: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-30 -translate-x-full transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : ""
        }`}
      >
        <Sidebar businessName={businessName} onNavigate={() => setSidebarOpen(false)} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={userName} role={role} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
