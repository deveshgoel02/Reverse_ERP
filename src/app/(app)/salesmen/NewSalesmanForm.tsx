"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function NewSalesmanForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/salesmen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: phone || undefined, email: email || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Could not add salesman.");
        return;
      }
      setName("");
      setPhone("");
      setEmail("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs text-text-muted">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-48 rounded-lg border border-border px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">Phone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Optional"
          className="w-36 rounded-lg border border-border px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Optional"
          className="w-56 rounded-lg border border-border px-3 py-1.5 text-sm"
        />
      </div>
      <Button type="submit" variant="primary" disabled={loading}>
        {loading ? "Adding..." : "Add Salesman"}
      </Button>
      {error && <p className="w-full text-sm text-[var(--status-critical-text)]">{error}</p>}
    </form>
  );
}
