"use client";

import { useRouter } from "next/navigation";

export function Topbar({ userName, role }: { userName: string; role: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-4 border-b border-border bg-surface px-6">
      <div className="text-right">
        <p className="text-sm font-medium text-text">{userName}</p>
        <p className="text-xs text-text-muted">{role}</p>
      </div>
      <button onClick={logout} className="text-sm text-text-muted hover:text-text">
        Sign out
      </button>
    </header>
  );
}
