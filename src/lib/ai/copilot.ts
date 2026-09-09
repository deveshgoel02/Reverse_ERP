import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/ui/format";

export interface CopilotAnswer {
  answer: string;
  intent: string;
  /** The raw data behind the answer, for a "show source data" expander in the UI. */
  data: unknown;
}

/**
 * Grounded question answering — Module N. Every number in `answer` comes
 * directly from a Prisma query in this file; there is no LLM call in this
 * path, so nothing can be invented (spec Module 30: "the LLM can explain
 * the result, the LLM should not be the source of truth"). Matches a
 * question to one of a fixed set of intents by keyword; unmatched
 * questions get an honest "I can't answer that yet" rather than a guess.
 *
 * src/lib/ai/llm-client.ts wires an optional LLM in front of this for
 * nicer phrasing/intent-matching when ANTHROPIC_API_KEY is set — this
 * function is what it calls to get grounded facts, and is also the
 * complete, fully-working fallback when no key is configured.
 */
export async function answerQuestion(businessId: string, question: string): Promise<CopilotAnswer> {
  const q = question.toLowerCase();

  if (/(slow|stuck|not mov|not sell)/.test(q)) return slowMovingByBrand(businessId, q);
  if (/(dead stock|dead-stock)/.test(q)) return deadStockAnswer(businessId);
  if (/(order|buy|purchase).*(next month|next|more|recommend)/.test(q) || /what should i order/.test(q)) return orderRecommendationsAnswer(businessId);
  if (/(reduce|less|stop order|do not order)/.test(q)) return reduceRecommendationsAnswer(businessId);
  if (/(haven'?t sold|no sales|not sold).*(\d+)\s*day/.test(q)) return noSalesInDaysAnswer(businessId, q);
  if (/older than.*(\d+)\s*day|stock.*(\d+)\s*day/.test(q)) return agingAnswer(businessId, q);
  if (/(best.sell|top.sell|best product)/.test(q)) return bestSellersAnswer(businessId, q);
  if (/(customer).*(most|top|best)/.test(q)) return topCustomersAnswer(businessId);
  if (/(highest|most).*(risk|exposure)/.test(q)) return brandRiskAnswer(businessId);
  if (/how much.*stuck|stuck.*stock/.test(q)) return stuckStockAnswer(businessId);

  return {
    intent: "unsupported",
    answer:
      "I can answer questions about slow-moving stock, dead stock, order recommendations, sales in the last N days, stock aging, best-selling products, top customers, and brand risk exposure. Try one of the example questions, or rephrase.",
    data: null,
  };
}

async function slowMovingByBrand(businessId: string, q: string): Promise<CopilotAnswer> {
  const brands = await prisma.brand.findMany({ where: { businessId } });
  const mentionedBrand = brands.find((b) => q.includes(b.name.toLowerCase()));

  const skus = await prisma.sku.findMany({
    where: {
      businessId,
      status: "ACTIVE",
      inventory: { status: { in: ["SLOW_MOVING", "AT_RISK"] } },
      ...(mentionedBrand ? { product: { brandId: mentionedBrand.id } } : {}),
    },
    include: { product: { include: { brand: true } }, inventory: true },
    take: 15,
  });

  if (skus.length === 0) {
    return {
      intent: "slow_moving",
      answer: mentionedBrand ? `No ${mentionedBrand.name} products are currently slow-moving or at risk.` : "No products are currently slow-moving or at risk.",
      data: [],
    };
  }

  const list = skus.map((s) => `${s.product.name} (${s.code}, ${s.inventory?.currentQuantity} units)`).join("; ");
  return {
    intent: "slow_moving",
    answer: `${skus.length} ${mentionedBrand ? mentionedBrand.name + " " : ""}product${skus.length === 1 ? "" : "s"} ${skus.length === 1 ? "is" : "are"} currently slow-moving or at risk: ${list}.`,
    data: skus.map((s) => ({ sku: s.code, product: s.product.name, brand: s.product.brand?.name, status: s.inventory?.status, qty: s.inventory?.currentQuantity })),
  };
}

async function deadStockAnswer(businessId: string): Promise<CopilotAnswer> {
  const skus = await prisma.sku.findMany({
    where: { businessId, status: "ACTIVE", inventory: { status: "DEAD_STOCK" } },
    include: { product: true, inventory: true },
  });
  const totalUnits = skus.reduce((sum, s) => sum + (s.inventory?.currentQuantity ?? 0), 0);
  const totalValue = skus.reduce((sum, s) => sum + (s.inventory ? Number(s.inventory.inventoryValue) : 0), 0);
  return {
    intent: "dead_stock",
    answer: `${skus.length} SKUs currently meet the dead-stock criteria — ${totalUnits} units worth ${formatINR(totalValue)}.`,
    data: skus.map((s) => ({ sku: s.code, product: s.product.name, qty: s.inventory?.currentQuantity })),
  };
}

async function orderRecommendationsAnswer(businessId: string): Promise<CopilotAnswer> {
  const recs = await prisma.recommendation.findMany({
    where: { businessId, status: "PENDING", type: "ORDER_MORE" },
    include: { sku: { include: { product: true } } },
    orderBy: { generatedAt: "desc" },
    take: 15,
  });
  if (recs.length === 0) return { intent: "order_more", answer: "No pending order-more recommendations right now.", data: [] };

  const list = recs.map((r) => `${r.sku.product.name} (${r.sku.code}): ${r.recommendedQty} units`).join("; ");
  return {
    intent: "order_more",
    answer: `${recs.length} SKUs are currently recommended to order more: ${list}.`,
    data: recs.map((r) => ({ sku: r.sku.code, product: r.sku.product.name, qty: r.recommendedQty, confidence: r.confidence })),
  };
}

async function reduceRecommendationsAnswer(businessId: string): Promise<CopilotAnswer> {
  const recs = await prisma.recommendation.findMany({
    where: { businessId, status: "PENDING", type: { in: ["ORDER_LESS", "DO_NOT_ORDER"] } },
    include: { sku: { include: { product: true } } },
    take: 15,
  });
  if (recs.length === 0) return { intent: "order_less", answer: "No pending order-less or do-not-order recommendations right now.", data: [] };

  const list = recs.map((r) => `${r.sku.product.name} (${r.sku.code})`).join("; ");
  return {
    intent: "order_less",
    answer: `${recs.length} SKUs are currently recommended to reduce or stop ordering: ${list}.`,
    data: recs.map((r) => ({ sku: r.sku.code, product: r.sku.product.name, type: r.type })),
  };
}

async function noSalesInDaysAnswer(businessId: string, q: string): Promise<CopilotAnswer> {
  const match = /(\d+)\s*day/.exec(q);
  const days = match ? Number(match[1]) : 90;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const skus = await prisma.sku.findMany({
    where: {
      businessId,
      status: "ACTIVE",
      OR: [{ inventory: { lastSaleAt: { lt: since } } }, { inventory: { lastSaleAt: null } }],
    },
    include: { product: true, inventory: true },
    take: 20,
  });

  if (skus.length === 0) return { intent: "no_sales", answer: `Every active SKU has sold within the last ${days} days.`, data: [] };
  const list = skus.map((s) => `${s.product.name} (${s.code})`).join("; ");
  return {
    intent: "no_sales",
    answer: `${skus.length} SKUs haven't sold in the last ${days} days: ${list}.`,
    data: skus.map((s) => ({ sku: s.code, product: s.product.name, lastSale: s.inventory?.lastSaleAt })),
  };
}

async function agingAnswer(businessId: string, q: string): Promise<CopilotAnswer> {
  const match = /(\d+)\s*day/.exec(q);
  const days = match ? Number(match[1]) : 180;

  const skus = await prisma.sku.findMany({
    where: { businessId, status: "ACTIVE", inventory: { stockAgeDays: { gte: days } } },
    include: { product: true, inventory: true },
    orderBy: { inventory: { stockAgeDays: "desc" } },
    take: 20,
  });

  if (skus.length === 0) return { intent: "aging", answer: `No SKUs have stock older than ${days} days.`, data: [] };
  const list = skus.map((s) => `${s.product.name} (${s.code}, ${s.inventory?.stockAgeDays}d)`).join("; ");
  return {
    intent: "aging",
    answer: `${skus.length} SKUs have stock older than ${days} days: ${list}.`,
    data: skus.map((s) => ({ sku: s.code, product: s.product.name, ageDays: s.inventory?.stockAgeDays })),
  };
}

async function bestSellersAnswer(businessId: string, q: string): Promise<CopilotAnswer> {
  const isLastYear = /last year/.test(q);
  const days = isLastYear ? 365 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const grouped = await prisma.saleItem.groupBy({
    by: ["skuId"],
    where: { sale: { businessId, saleDate: { gte: since } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 10,
  });
  if (grouped.length === 0) return { intent: "best_sellers", answer: `No sales recorded in the ${isLastYear ? "last year" : "last 30 days"}.`, data: [] };

  const skus = await prisma.sku.findMany({ where: { id: { in: grouped.map((g) => g.skuId) } }, include: { product: true } });
  const skuMap = new Map(skus.map((s) => [s.id, s]));
  const list = grouped.map((g) => `${skuMap.get(g.skuId)?.product.name ?? g.skuId} (${g._sum.quantity} units)`).join("; ");

  return {
    intent: "best_sellers",
    answer: `Best-selling products (${isLastYear ? "last year" : "last 30 days"}): ${list}.`,
    data: grouped.map((g) => ({ sku: skuMap.get(g.skuId)?.code, product: skuMap.get(g.skuId)?.product.name, unitsSold: g._sum.quantity })),
  };
}

async function topCustomersAnswer(businessId: string): Promise<CopilotAnswer> {
  const items = await prisma.saleItem.findMany({
    where: { sale: { businessId, customerId: { not: null } } },
    select: { totalAmount: true, sale: { select: { customerId: true } } },
  });
  const totals = new Map<string, number>();
  for (const i of items) {
    const cid = i.sale.customerId!;
    totals.set(cid, (totals.get(cid) ?? 0) + Number(i.totalAmount));
  }
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length === 0) return { intent: "top_customers", answer: "No sales with a customer recorded yet.", data: [] };

  const customers = await prisma.customer.findMany({ where: { id: { in: top.map(([id]) => id) } } });
  const nameMap = new Map(customers.map((c) => [c.id, c.name]));
  const list = top.map(([id, total]) => `${nameMap.get(id) ?? id} (${formatINR(total)})`).join("; ");

  return {
    intent: "top_customers",
    answer: `Top customers by total spend: ${list}.`,
    data: top.map(([id, total]) => ({ customer: nameMap.get(id), totalSpend: total })),
  };
}

async function brandRiskAnswer(businessId: string): Promise<CopilotAnswer> {
  const brands = await prisma.brand.findMany({
    where: { businessId },
    include: { products: { include: { skus: { include: { inventory: true } } } } },
  });
  const rows = brands.map((b) => {
    const skus = b.products.flatMap((p) => p.skus);
    const riskValue = skus
      .filter((s) => s.inventory && (s.inventory.status === "DEAD_STOCK" || s.inventory.status === "AT_RISK"))
      .reduce((sum, s) => sum + Number(s.inventory!.inventoryValue), 0);
    return { brand: b.name, riskValue };
  });
  rows.sort((a, b) => b.riskValue - a.riskValue);
  const top = rows[0];
  if (!top || top.riskValue === 0) return { intent: "brand_risk", answer: "No brand currently has significant dead/at-risk stock exposure.", data: rows };

  return {
    intent: "brand_risk",
    answer: `${top.brand} has the highest inventory risk exposure — ${formatINR(top.riskValue)} tied up in dead or at-risk stock.`,
    data: rows,
  };
}

async function stuckStockAnswer(businessId: string): Promise<CopilotAnswer> {
  const statuses = await prisma.inventory.groupBy({
    by: ["status"],
    where: { sku: { businessId, status: "ACTIVE" }, status: { in: ["DEAD_STOCK", "AT_RISK"] } },
    _sum: { currentQuantity: true, inventoryValue: true },
    _count: true,
  });
  const totalUnits = statuses.reduce((sum, s) => sum + (s._sum.currentQuantity ?? 0), 0);
  const totalValue = statuses.reduce((sum, s) => sum + Number(s._sum.inventoryValue ?? 0), 0);
  const totalSkus = statuses.reduce((sum, s) => sum + s._count, 0);

  return {
    intent: "stuck_stock",
    answer:
      totalSkus === 0
        ? "No stock is currently stuck (dead or at-risk)."
        : `${totalSkus} SKUs (${totalUnits} units, ${formatINR(totalValue)}) are currently stuck as dead or at-risk stock.`,
    data: statuses,
  };
}

