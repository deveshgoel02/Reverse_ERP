"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { writeAuditLog } from "@/lib/audit/log";

const createSchema = z.object({
  skuId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  deadlineDate: z.string().min(1),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]),
  notes: z.string().optional(),
});

export async function createStockDeadline(formData: FormData) {
  const user = await requireUser();
  const parsed = createSchema.parse({
    skuId: formData.get("skuId"),
    quantity: formData.get("quantity"),
    deadlineDate: formData.get("deadlineDate"),
    priority: formData.get("priority"),
    notes: formData.get("notes") || undefined,
  });

  const sku = await prisma.sku.findFirst({ where: { id: parsed.skuId, businessId: user.businessId } });
  if (!sku) throw new Error("SKU not found");

  const deadline = await prisma.stockDeadline.create({
    data: {
      businessId: user.businessId,
      skuId: parsed.skuId,
      quantity: parsed.quantity,
      deadlineDate: new Date(parsed.deadlineDate),
      priority: parsed.priority,
      notes: parsed.notes,
    },
  });

  await writeAuditLog({
    businessId: user.businessId,
    actorId: user.id,
    action: "CREATE",
    entityType: "StockDeadline",
    entityId: deadline.id,
    newValue: deadline,
  });

  revalidatePath("/deadlines");
}

export async function cancelStockDeadline(id: string) {
  const user = await requireUser();
  const existing = await prisma.stockDeadline.findFirst({ where: { id, businessId: user.businessId } });
  if (!existing) throw new Error("Deadline not found");

  await prisma.stockDeadline.update({ where: { id }, data: { status: "CANCELLED" } });
  await writeAuditLog({
    businessId: user.businessId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "StockDeadline",
    entityId: id,
    previousValue: { status: existing.status },
    newValue: { status: "CANCELLED" },
  });

  revalidatePath("/deadlines");
}
