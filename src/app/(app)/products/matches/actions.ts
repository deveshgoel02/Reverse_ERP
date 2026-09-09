"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { detectProductMatchCandidates } from "@/lib/catalog/product-matching";
import { mergeProducts } from "@/lib/catalog/merge";
import { writeAuditLog } from "@/lib/audit/log";

export async function runDetection() {
  const user = await requireUser();
  await detectProductMatchCandidates(user.businessId);
  revalidatePath("/products/matches");
}

export async function confirmMerge(suggestionId: string, keepProductId: string, mergeProductId: string) {
  const user = await requireUser();
  const suggestion = await prisma.productMatchSuggestion.findFirst({ where: { id: suggestionId, businessId: user.businessId } });
  if (!suggestion) throw new Error("Suggestion not found.");

  await mergeProducts(user.businessId, user.id, keepProductId, mergeProductId);
  await prisma.productMatchSuggestion.update({ where: { id: suggestionId }, data: { status: "CONFIRMED", decidedAt: new Date() } });

  revalidatePath("/products/matches");
  revalidatePath("/products");
}

export async function rejectMatch(suggestionId: string) {
  const user = await requireUser();
  const suggestion = await prisma.productMatchSuggestion.findFirst({ where: { id: suggestionId, businessId: user.businessId } });
  if (!suggestion) throw new Error("Suggestion not found.");

  await prisma.productMatchSuggestion.update({ where: { id: suggestionId }, data: { status: "REJECTED", decidedAt: new Date() } });
  await writeAuditLog({
    businessId: user.businessId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "ProductMatchSuggestion",
    entityId: suggestionId,
    newValue: { status: "REJECTED" },
  });

  revalidatePath("/products/matches");
}
