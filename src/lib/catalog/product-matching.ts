import { prisma } from "@/lib/db";

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  const tokensA = new Set(na.split(" "));
  const tokensB = new Set(nb.split(" "));
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = union === 0 ? 0 : intersection / union;
  // Boost for one name being a prefix/substring of the other (e.g. "Adidas ABC" vs "Adidas ABC Black").
  const substringBoost = na.includes(nb) || nb.includes(na) ? 0.15 : 0;
  return Math.min(1, jaccard + substringBoost);
}

const MIN_CONFIDENCE = 0.55;

/**
 * Module F: uploaded historical files often spell the same product
 * differently ("Adidas Shoe ABC" / "Adidas-ABC" / "ADIDAS ABC"). This
 * NEVER auto-merges — it only proposes candidates (ProductMatchSuggestion,
 * status PENDING) for the owner to confirm, merge, or reject from
 * /products/matches. Compares within the same brand only, to keep the
 * O(n^2) comparison cheap and the false-positive rate low.
 */
export async function detectProductMatchCandidates(businessId: string): Promise<number> {
  const products = await prisma.product.findMany({
    where: { businessId, status: "ACTIVE" },
    select: { id: true, name: true, brandId: true },
  });

  const byBrand = new Map<string, typeof products>();
  for (const p of products) {
    const key = p.brandId ?? "__no_brand__";
    byBrand.set(key, [...(byBrand.get(key) ?? []), p]);
  }

  const existing = await prisma.productMatchSuggestion.findMany({
    where: { businessId, status: "PENDING" },
    select: { productAId: true, productBId: true },
  });
  const existingPairs = new Set(existing.map((e) => pairKey(e.productAId, e.productBId)));

  let created = 0;
  for (const group of byBrand.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const confidence = similarity(group[i].name, group[j].name);
        if (confidence < MIN_CONFIDENCE) continue;
        if (existingPairs.has(pairKey(group[i].id, group[j].id))) continue;

        await prisma.productMatchSuggestion.create({
          data: {
            businessId,
            productAId: group[i].id,
            productBId: group[j].id,
            confidence,
            reason: "normalized name similarity within the same brand",
          },
        });
        created++;
      }
    }
  }
  return created;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}
