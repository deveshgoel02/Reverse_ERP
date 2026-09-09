"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const ENTITY_TYPES = [
  { value: "SALES", label: "Sales history" },
  { value: "PURCHASES", label: "Purchase history" },
  { value: "INVENTORY", label: "Stock take / current inventory" },
  { value: "PRODUCTS", label: "Product / SKU catalog" },
  { value: "CUSTOMERS", label: "Customers" },
  { value: "SUPPLIERS", label: "Suppliers" },
];

export function UploadForm() {
  const router = useRouter();
  const [entityType, setEntityType] = useState("SALES");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a .csv or .xlsx file first.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      const res = await fetch("/api/import/upload", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Upload failed.");
        return;
      }
      router.push(`/import/${body.importId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Import Historical or Current Data" subtitle="Upload a CSV or Excel file. You'll confirm column mapping and preview before anything is saved." />
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-muted">What does this file contain?</label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-border px-3 py-2 text-sm"
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-muted">File (.csv or .xlsx, max 10MB)</label>
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full max-w-sm text-sm"
          />
        </div>
        {error && <p className="text-sm text-[var(--status-critical-text)]">{error}</p>}
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? "Uploading..." : "Upload & Continue"}
        </Button>
      </form>
    </Card>
  );
}
