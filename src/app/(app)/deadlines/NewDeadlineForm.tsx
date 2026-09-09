"use client";

import { useRef, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createStockDeadline } from "./actions";

export function NewDeadlineForm({ skus }: { skus: { id: string; label: string }[] }) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="flex flex-wrap items-end gap-2"
      action={(formData) =>
        startTransition(async () => {
          await createStockDeadline(formData);
          formRef.current?.reset();
        })
      }
    >
      <div>
        <label className="mb-1 block text-xs text-text-muted">SKU</label>
        <select name="skuId" required className="w-64 rounded-lg border border-border px-3 py-1.5 text-sm">
          {skus.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">Quantity</label>
        <input name="quantity" type="number" min={1} required className="w-24 rounded-lg border border-border px-3 py-1.5 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">Deadline</label>
        <input name="deadlineDate" type="date" required className="rounded-lg border border-border px-3 py-1.5 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">Priority</label>
        <select name="priority" defaultValue="NORMAL" className="rounded-lg border border-border px-3 py-1.5 text-sm">
          <option value="LOW">Low</option>
          <option value="NORMAL">Normal</option>
          <option value="HIGH">High</option>
        </select>
      </div>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Adding..." : "Add Deadline"}
      </Button>
    </form>
  );
}
