"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Option {
  id: string;
  name: string;
}

export function NewAllotmentForm({
  salesmen,
  customers,
  brands,
}: {
  salesmen: Option[];
  customers: Option[];
  brands: Option[];
}) {
  const router = useRouter();
  const [salesmanId, setSalesmanId] = useState(salesmen[0]?.id ?? "");
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [targetQuantity, setTargetQuantity] = useState(50);
  const [incentiveAmount, setIncentiveAmount] = useState(0);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/allotments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesmanId,
          customerId,
          brandId,
          targetQuantity,
          incentiveAmount,
          deadlineDate,
          notes: notes || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Could not create allotment.");
        return;
      }
      router.push("/allotments");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const missingMasterData = salesmen.length === 0 || customers.length === 0 || brands.length === 0;

  return (
    <Card>
      <CardHeader
        title="Allot a Target"
        subtitle="Sell a quantity of one brand to one party, by this salesman, before the deadline."
      />
      {missingMasterData ? (
        <p className="text-sm text-text-muted">
          You need at least one salesman, one customer, and one brand before you can create an allotment.
          {salesmen.length === 0 && (
            <>
              {" "}
              Add a salesman on the{" "}
              <a href="/salesmen" className="text-primary hover:underline">
                Salesmen
              </a>{" "}
              page.
            </>
          )}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Salesman</label>
              <select value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)} required className="w-full rounded-lg border border-border px-3 py-1.5 text-sm">
                {salesmen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Party (Customer)</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required className="w-full rounded-lg border border-border px-3 py-1.5 text-sm">
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Brand</label>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} required className="w-full rounded-lg border border-border px-3 py-1.5 text-sm">
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Target Quantity (units/shoes)</label>
              <input
                type="number"
                min={1}
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(Number(e.target.value))}
                required
                className="w-full rounded-lg border border-border px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Incentive (₹)</label>
              <input
                type="number"
                min={0}
                value={incentiveAmount}
                onChange={(e) => setIncentiveAmount(Number(e.target.value))}
                className="w-full rounded-lg border border-border px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Deadline</label>
              <input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                required
                className="w-full rounded-lg border border-border px-3 py-1.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-border px-3 py-1.5 text-sm"
            />
          </div>
          {error && <p className="text-sm text-[var(--status-critical-text)]">{error}</p>}
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "Creating..." : "Create Allotment"}
          </Button>
        </form>
      )}
    </Card>
  );
}
