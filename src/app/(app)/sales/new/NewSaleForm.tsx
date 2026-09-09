"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";

interface SkuOption {
  id: string;
  label: string;
  sellingPrice: number;
}

interface LineItem {
  skuId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
}

export function NewSaleForm({
  customers,
  skus,
  salesmen,
}: {
  customers: { id: string; name: string }[];
  skus: SkuOption[];
  salesmen: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [salesmanId, setSalesmanId] = useState("");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invoiceRef, setInvoiceRef] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { skuId: skus[0]?.id ?? "", quantity: 1, unitPrice: skus[0]?.sellingPrice ?? 0, discount: 0, tax: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addLine() {
    setItems((prev) => [...prev, { skuId: skus[0]?.id ?? "", quantity: 1, unitPrice: skus[0]?.sellingPrice ?? 0, discount: 0, tax: 0 }]);
  }

  function removeLine(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function onSkuChange(index: number, skuId: string) {
    const sku = skus.find((s) => s.id === skuId);
    updateItem(index, { skuId, unitPrice: sku?.sellingPrice ?? 0 });
  }

  const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice - i.discount + i.tax, 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || undefined,
          salesmanId: salesmanId || undefined,
          saleDate,
          invoiceRef: invoiceRef || undefined,
          items,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not create sale.");
        return;
      }
      router.push("/sales");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader title="Invoice Details" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Customer</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full rounded-lg border border-border px-3 py-1.5 text-sm">
              <option value="">Walk-in / none</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Salesman</label>
            <select value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)} className="w-full rounded-lg border border-border px-3 py-1.5 text-sm">
              <option value="">Unattributed</option>
              {salesmen.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Sale Date</label>
            <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} required className="w-full rounded-lg border border-border px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Invoice Ref</label>
            <input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} placeholder="Optional" className="w-full rounded-lg border border-border px-3 py-1.5 text-sm" />
          </div>
        </div>
      </Card>

      <Card padding="p-0">
        <div className="p-5 pb-0">
          <CardHeader title="Line Items" />
        </div>
        <Table>
          <Thead>
            <Th>SKU</Th>
            <Th className="text-right">Qty</Th>
            <Th className="text-right">Unit Price</Th>
            <Th className="text-right">Discount</Th>
            <Th className="text-right">Tax</Th>
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
                    value={item.quantity}
                    onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-border px-2 py-1 text-right text-sm"
                  />
                </Td>
                <Td className="text-right">
                  <input
                    type="number"
                    min={0}
                    value={item.unitPrice}
                    onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) })}
                    className="w-24 rounded-lg border border-border px-2 py-1 text-right text-sm"
                  />
                </Td>
                <Td className="text-right">
                  <input
                    type="number"
                    min={0}
                    value={item.discount}
                    onChange={(e) => updateItem(i, { discount: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-border px-2 py-1 text-right text-sm"
                  />
                </Td>
                <Td className="text-right">
                  <input
                    type="number"
                    min={0}
                    value={item.tax}
                    onChange={(e) => updateItem(i, { tax: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-border px-2 py-1 text-right text-sm"
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
        <div className="flex items-center justify-between p-4">
          <Button type="button" variant="secondary" onClick={addLine}>
            + Add Line
          </Button>
          <p className="text-sm font-medium text-text">Total: ₹{total.toLocaleString("en-IN")}</p>
        </div>
      </Card>

      {error && <p className="text-sm text-[var(--status-critical-text)]">{error}</p>}
      <Button type="submit" variant="primary" disabled={loading || skus.length === 0}>
        {loading ? "Saving..." : "Record Sale"}
      </Button>
    </form>
  );
}
