"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";

interface SkuOption {
  id: string;
  label: string;
  purchasePrice: number;
}

interface LineItem {
  skuId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
}

export function NewPurchaseForm({ suppliers, skus }: { suppliers: { id: string; name: string }[]; skus: SkuOption[] }) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { skuId: skus[0]?.id ?? "", quantityOrdered: 1, quantityReceived: 0, unitCost: skus[0]?.purchasePrice ?? 0 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addLine() {
    setItems((prev) => [...prev, { skuId: skus[0]?.id ?? "", quantityOrdered: 1, quantityReceived: 0, unitCost: skus[0]?.purchasePrice ?? 0 }]);
  }

  function removeLine(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function onSkuChange(index: number, skuId: string) {
    const sku = skus.find((s) => s.id === skuId);
    updateItem(index, { skuId, unitCost: sku?.purchasePrice ?? 0 });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          orderDate,
          expectedDeliveryDate: expectedDeliveryDate || undefined,
          invoiceRef: invoiceRef || undefined,
          items,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not create purchase.");
        return;
      }
      router.push("/purchases");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader title="Purchase Order Details" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Supplier</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required className="w-full rounded-lg border border-border px-3 py-1.5 text-sm">
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Order Date</label>
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} required className="w-full rounded-lg border border-border px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Expected Delivery</label>
            <input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className="w-full rounded-lg border border-border px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">PO / Invoice Ref</label>
            <input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} placeholder="Optional" className="w-full rounded-lg border border-border px-3 py-1.5 text-sm" />
          </div>
        </div>
      </Card>

      <Card padding="p-0">
        <div className="p-5 pb-0">
          <CardHeader title="Line Items" subtitle="Leave 'Received' at 0 for a purchase order that hasn't arrived yet." />
        </div>
        <Table>
          <Thead>
            <Th>SKU</Th>
            <Th className="text-right">Ordered</Th>
            <Th className="text-right">Received</Th>
            <Th className="text-right">Unit Cost</Th>
            <Th></Th>
          </Thead>
          <Tbody>
            {items.map((item, i) => (
              <Tr key={i}>
                <Td>
                  <select value={item.skuId} onChange={(e) => onSkuChange(i, e.target.value)} className="rounded-lg border border-border px-2 py-1 text-sm">
                    {skus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Td>
                <Td className="text-right">
                  <input
                    type="number"
                    min={1}
                    value={item.quantityOrdered}
                    onChange={(e) => updateItem(i, { quantityOrdered: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-border px-2 py-1 text-right text-sm"
                  />
                </Td>
                <Td className="text-right">
                  <input
                    type="number"
                    min={0}
                    value={item.quantityReceived}
                    onChange={(e) => updateItem(i, { quantityReceived: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-border px-2 py-1 text-right text-sm"
                  />
                </Td>
                <Td className="text-right">
                  <input
                    type="number"
                    min={0}
                    value={item.unitCost}
                    onChange={(e) => updateItem(i, { unitCost: Number(e.target.value) })}
                    className="w-24 rounded-lg border border-border px-2 py-1 text-right text-sm"
                  />
                </Td>
                <Td>
                  <Button type="button" variant="ghost" disabled={items.length === 1} onClick={() => removeLine(i)}>
                    Remove
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        <div className="p-4">
          <Button type="button" variant="secondary" onClick={addLine}>
            + Add Line
          </Button>
        </div>
      </Card>

      {error && <p className="text-sm text-[var(--status-critical-text)]">{error}</p>}
      <Button type="submit" variant="primary" disabled={loading || skus.length === 0 || suppliers.length === 0}>
        {loading ? "Saving..." : "Create Purchase Order"}
      </Button>
    </form>
  );
}
