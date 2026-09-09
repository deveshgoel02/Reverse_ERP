"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireRole } from "@/lib/auth/current-user";
import { setSetting } from "@/lib/settings/get";
import { writeAuditLog } from "@/lib/audit/log";
import type { SettingKey } from "@/lib/settings/defaults";

export async function saveSettings(formData: FormData) {
  const user = await requireUser();
  requireRole(user, "MANAGER");

  const numericKeys: SettingKey[] = [
    "slowMovingDays",
    "atRiskDays",
    "deadStockDays",
    "deadStockMinUnitsSold",
    "overstockedDaysCover",
    "understockedDaysCover",
    "defaultSafetyStockDays",
    "defaultLeadTimeDays",
    "highExposureValueThreshold",
  ];

  for (const key of numericKeys) {
    const raw = formData.get(key);
    if (raw === null || raw === "") continue;
    const value = Number(raw);
    if (Number.isNaN(value)) continue;
    await setSetting(user.businessId, key, value);
  }

  await writeAuditLog({
    businessId: user.businessId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "Setting",
    entityId: user.businessId,
    note: "Updated classification/alert thresholds",
  });

  revalidatePath("/settings");
}
