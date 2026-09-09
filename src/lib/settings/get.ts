import { prisma } from "@/lib/db";
import { DEFAULT_SETTINGS, type SettingsShape } from "./defaults";

/**
 * Resolves the full settings object for a business, with optional
 * brand/category-scoped overrides layered on top of business-level
 * overrides, layered on top of DEFAULT_SETTINGS. Nothing here is
 * hard-coded in the classification/recommendation engines — every number
 * flows through this function so the owner can tune behaviour from the UI
 * (Settings page) without a code change.
 */
export async function getSettings(
  businessId: string,
  scope?: { brandId?: string; categoryId?: string },
): Promise<SettingsShape> {
  const rows = await prisma.setting.findMany({ where: { businessId } });

  const resolved: Record<string, unknown> = { ...DEFAULT_SETTINGS };

  applyScope(resolved, rows, "BUSINESS", "");
  if (scope?.brandId) applyScope(resolved, rows, "BRAND", scope.brandId);
  if (scope?.categoryId) applyScope(resolved, rows, "CATEGORY", scope.categoryId);

  return resolved as unknown as SettingsShape;
}

function applyScope(
  target: Record<string, unknown>,
  rows: { key: string; scopeType: string; scopeId: string; value: unknown }[],
  scopeType: string,
  scopeId: string,
) {
  for (const row of rows) {
    if (row.scopeType === scopeType && row.scopeId === scopeId) {
      target[row.key] = row.value;
    }
  }
}

/** Upserts a single setting override. Pass value: null semantics are not supported — delete the row to revert to default. */
export async function setSetting(
  businessId: string,
  key: keyof SettingsShape,
  value: unknown,
  scope?: { scopeType: "BUSINESS" | "BRAND" | "CATEGORY"; scopeId?: string },
) {
  const scopeType = scope?.scopeType ?? "BUSINESS";
  const scopeId = scope?.scopeId ?? "";
  return prisma.setting.upsert({
    where: {
      businessId_key_scopeType_scopeId: { businessId, key: key as string, scopeType, scopeId },
    },
    create: { businessId, key: key as string, scopeType, scopeId, value: value as never },
    update: { value: value as never },
  });
}
