"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth/current-user";
import { writeAuditLog } from "@/lib/audit/log";

export async function cancelAllotment(id: string) {
  const user = await requireUser();
  requireRole(user, "MANAGER");

  const existing = await prisma.allotment.findFirst({ where: { id, businessId: user.businessId } });
  if (!existing) throw new Error("Allotment not found");

  await prisma.allotment.update({ where: { id }, data: { status: "CANCELLED" } });
  await writeAuditLog({
    businessId: user.businessId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "Allotment",
    entityId: id,
    previousValue: { status: existing.status },
    newValue: { status: "CANCELLED" },
  });

  revalidatePath("/allotments");
}
