"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { writeAuditLog } from "@/lib/audit/log";

export async function dismissAlert(alertId: string) {
  const user = await requireUser();
  const existing = await prisma.alert.findFirst({ where: { id: alertId, businessId: user.businessId } });
  if (!existing) throw new Error("Alert not found");

  await prisma.alert.update({
    where: { id: alertId },
    data: { status: "DISMISSED", dismissedById: user.id, dismissedAt: new Date() },
  });

  await writeAuditLog({
    businessId: user.businessId,
    actorId: user.id,
    action: "ALERT_DISMISS",
    entityType: "Alert",
    entityId: alertId,
    previousValue: { status: existing.status },
    newValue: { status: "DISMISSED" },
  });

  revalidatePath("/alerts");
  revalidatePath("/dashboard");
}
