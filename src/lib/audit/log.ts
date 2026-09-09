import { prisma } from "@/lib/db";
import type { AuditAction } from "@/lib/enums";

/**
 * Every business-critical mutation should call this — see Module Q of the
 * spec. previousValue/newValue are stored as JSON snapshots so a change can
 * be explained (or, manually, reversed) later without guessing.
 */
export async function writeAuditLog(entry: {
  businessId: string;
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  note?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      businessId: entry.businessId,
      actorId: entry.actorId ?? undefined,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      previousValue: entry.previousValue === undefined ? undefined : (entry.previousValue as never),
      newValue: entry.newValue === undefined ? undefined : (entry.newValue as never),
      note: entry.note,
    },
  });
}
