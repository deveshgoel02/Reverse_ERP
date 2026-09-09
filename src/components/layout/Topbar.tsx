"use client";

import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Topbar({
  userName,
  role,
  onMenuClick,
}: {
  userName: string;
  role: string;
  onMenuClick?: () => void;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface px-4 sm:px-6">
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-bg hover:text-text md:hidden"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>
      <div className="flex flex-1 items-center justify-end gap-4">
        <ThemeToggle />
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-text">{userName}</p>
          <p className="text-xs text-text-muted">{role}</p>
        </div>
        <button onClick={logout} className="text-sm text-text-muted hover:text-text">
          Sign out
        </button>
      </div>
    </header>
  );
}
