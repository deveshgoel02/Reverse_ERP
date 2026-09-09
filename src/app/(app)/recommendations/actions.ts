"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { writeAuditLog } from "@/lib/audit/log";
import type { RecommendationStatus } from "@/lib/enums";

/**
 * Owner decision on a system recommendation — Module 31 "Owner Control".
 * This never places an order or changes inventory; it only records the
 * decision for the audit trail (Module Q / Module 15 "AI safety").
 */
export async function decideRecommendation(recommendationId: string, decision: Extract<RecommendationStatus, "ACCEPTED" | "REJECTED">) {
  const user = await requireUser();

  const existing = await prisma.recommendation.findFirst({
    where: { id: recommendationId, businessId: user.businessId },
  });
  if (!existing) throw new Error("Recommendation not found");

  const updated = await prisma.recommendation.update({
    where: { id: recommendationId },
    data: { status: decision, decidedById: user.id, decidedAt: new Date() },
  });

  await writeAuditLog({
    businessId: user.businessId,
    actorId: user.id,
    action: "RECOMMENDATION_DECISION",
    entityType: "Recommendation",
    entityId: recommendationId,
    previousValue: { status: existing.status },
    newValue: { status: updated.status },
  });

  revalidatePath("/recommendations");
  revalidatePath("/dashboard");
}
