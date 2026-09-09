import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings/get";
import { getRecentVelocity } from "@/lib/analytics/aggregate";
import type { AlertType, Severity } from "@/lib/enums";

/**
 * Rules-based alert generation — Module O. Idempotent: won't create a
 * duplicate OPEN alert for the same (type, relatedEntityId) pair, so this
 * is safe to re-run after every import/sale/purchase batch or on a
 * schedule.
 */
export async function generateAlertsForBusiness(businessId: string): Promise<number> {
  let created = 0;
  created += await stockStatusAlerts(businessId);
  created += await deadlineAlerts(businessId);
  created += await salesTrendAlerts(businessId);
  created += await supplierDelayAlerts(businessId);
  created += await highExposureAlerts(businessId);
  created += await forecastShortageAlerts(businessId);
  return created;
}

async function createIfNotOpen(params: {
  businessId: string;
  type: AlertType;
  severity: Severity;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
}): Promise<boolean> {
  const existing = await prisma.alert.findFirst({
    where: {
      businessId: params.businessId,
      type: params.type,
      relatedEntityId: params.relatedEntityId,
      status: "OPEN",
    },
  });
  if (existing) return false;
  await prisma.alert.create({
    data: {
      businessId: params.businessId,
      type: params.type,
      severity: params.severity,
      message: params.message,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
    },
  });
  return true;
}

async function stockStatusAlerts(businessId: string): Promise<number> {
  const skus = await prisma.sku.findMany({
    where: { businessId, status: "ACTIVE" },
    include: { inventory: true, product: { select: { name: true } } },
  });

  let created = 0;
  for (const sku of skus) {
    if (!sku.inventory) continue;
    const label = `${sku.product.name} (${sku.code})`;

    if (sku.inventory.status === "DEAD_STOCK") {
      if (
        await createIfNotOpen({
          businessId,
          type: "DEAD_STOCK",
          severity: "HIGH",
          message: `${label} is classified as dead stock — ${sku.inventory.currentQuantity} units, ${sku.inventory.stockAgeDays ?? "?"} days old.`,
          relatedEntityType: "Sku",
          relatedEntityId: sku.id,
        })
      )
        created++;
    } else if (sku.inventory.status === "AT_RISK") {
      if (
        await createIfNotOpen({
          businessId,
          type: "AGING",
          severity: "MEDIUM",
          message: `${label} is at risk of becoming dead stock — no recent sales momentum.`,
          relatedEntityType: "Sku",
          relatedEntityId: sku.id,
        })
      )
        created++;
    }

    if (sku.inventory.status === "OVERSTOCKED") {
      if (
        await createIfNotOpen({
          businessId,
          type: "OVERSTOCK",
          severity: "MEDIUM",
          message: `${label} is overstocked — ${sku.inventory.currentQuantity} units on hand well above recent demand.`,
          relatedEntityType: "Sku",
          relatedEntityId: sku.id,
        })
      )
        created++;
    }

    if (sku.inventory.status === "OUT_OF_STOCK" || sku.inventory.status === "UNDERSTOCKED") {
      if (
        await createIfNotOpen({
          businessId,
          type: "LOW_STOCK",
          severity: sku.inventory.status === "OUT_OF_STOCK" ? "CRITICAL" : "HIGH",
          message:
            sku.inventory.status === "OUT_OF_STOCK"
              ? `${label} is out of stock.`
              : `${label} has only ${sku.inventory.currentQuantity} units left — below the understock threshold.`,
          relatedEntityType: "Sku",
          relatedEntityId: sku.id,
        })
      )
        created++;
    }
  }
  return created;
}

async function deadlineAlerts(businessId: string): Promise<number> {
  const settings = await getSettings(businessId);
  const deadlines = await prisma.stockDeadline.findMany({
    where: { businessId, status: "OPEN" },
    include: { sku: { include: { product: { select: { name: true } } } } },
  });

  let created = 0;
  const now = Date.now();
  for (const d of deadlines) {
    const daysUntil = Math.floor((d.deadlineDate.getTime() - now) / (1000 * 60 * 60 * 24));
    const label = `${d.sku.product.name} (${d.sku.code})`;

    if (daysUntil < 0) {
      await prisma.stockDeadline.update({ where: { id: d.id }, data: { status: "MISSED" } });
      if (
        await createIfNotOpen({
          businessId,
          type: "DEADLINE_MISSED",
          severity: "HIGH",
          message: `Deadline for ${label} (${d.quantity} units) was ${Math.abs(daysUntil)} day(s) ago.`,
          relatedEntityType: "StockDeadline",
          relatedEntityId: d.id,
        })
      )
        created++;
      continue;
    }

    const windows = settings.deadlineAlertWindowsDays as unknown as number[];
    if (windows.some((w) => daysUntil <= w)) {
      if (
        await createIfNotOpen({
          businessId,
          type: "DEADLINE_APPROACHING",
          severity: daysUntil <= 7 ? "HIGH" : "MEDIUM",
          message: `Deadline for ${label} (${d.quantity} units) is in ${daysUntil} day(s).`,
          relatedEntityType: "StockDeadline",
          relatedEntityId: d.id,
        })
      )
        created++;
    }
  }
  return created;
}

async function salesTrendAlerts(businessId: string): Promise<number> {
  const settings = await getSettings(businessId);
  const skus = await prisma.sku.findMany({
    where: { businessId, status: "ACTIVE" },
    include: { product: { select: { name: true } } },
  });

  let created = 0;
  for (const sku of skus) {
    const [recent, prior] = await Promise.all([
      getRecentVelocity(sku.id, 30),
      getVelocityInRange(sku.id, 60, 30),
    ]);
    if (prior <= 0) continue;
    const change = (recent - prior) / prior;
    const label = `${sku.product.name} (${sku.code})`;

    if (change >= settings.salesChangeAlertThreshold) {
      if (
        await createIfNotOpen({
          businessId,
          type: "SALES_SPIKE",
          severity: "LOW",
          message: `${label} sales velocity is up ${Math.round(change * 100)}% vs. the prior 30 days.`,
          relatedEntityType: "Sku",
          relatedEntityId: sku.id,
        })
      )
        created++;
    } else if (change <= -settings.salesChangeAlertThreshold) {
      if (
        await createIfNotOpen({
          businessId,
          type: "SALES_DECLINE",
          severity: "MEDIUM",
          message: `${label} sales velocity is down ${Math.round(Math.abs(change) * 100)}% vs. the prior 30 days.`,
          relatedEntityType: "Sku",
          relatedEntityId: sku.id,
        })
      )
        created++;
    }
  }
  return created;
}

/** Velocity for the window [daysAgoStart, daysAgoEnd) — e.g. (60,30) = the 30 days before the trailing 30. */
async function getVelocityInRange(skuId: string, daysAgoStart: number, daysAgoEnd: number): Promise<number> {
  const start = new Date(Date.now() - daysAgoStart * 24 * 60 * 60 * 1000);
  const end = new Date(Date.now() - daysAgoEnd * 24 * 60 * 60 * 1000);
  const result = await prisma.saleItem.aggregate({
    where: { skuId, sale: { saleDate: { gte: start, lt: end } } },
    _sum: { quantity: true },
  });
  return (result._sum.quantity ?? 0) / (daysAgoStart - daysAgoEnd);
}

async function supplierDelayAlerts(businessId: string): Promise<number> {
  const overdue = await prisma.purchase.findMany({
    where: {
      businessId,
      status: { in: ["PENDING", "PARTIALLY_RECEIVED"] },
      expectedDeliveryDate: { lt: new Date() },
    },
    include: { supplier: { select: { name: true } } },
  });

  let created = 0;
  for (const p of overdue) {
    if (
      await createIfNotOpen({
        businessId,
        type: "SUPPLIER_DELAY",
        severity: "MEDIUM",
        message: `Purchase order ${p.invoiceRef ?? p.id} from ${p.supplier.name} is past its expected delivery date and still ${p.status === "PENDING" ? "not received" : "only partially received"}.`,
        relatedEntityType: "Purchase",
        relatedEntityId: p.id,
      })
    )
      created++;
  }
  return created;
}

async function highExposureAlerts(businessId: string): Promise<number> {
  const settings = await getSettings(businessId);
  const brands = await prisma.brand.findMany({ where: { businessId } });

  let created = 0;
  for (const brand of brands) {
    const skus = await prisma.sku.findMany({
      where: { businessId, product: { brandId: brand.id } },
      include: { inventory: true },
    });
    const totalValue = skus.reduce((sum, s) => sum + (s.inventory ? Number(s.inventory.inventoryValue) : 0), 0);

    if (totalValue > settings.highExposureValueThreshold) {
      if (
        await createIfNotOpen({
          businessId,
          type: "HIGH_EXPOSURE",
          severity: "MEDIUM",
          message: `${brand.name} inventory exposure is ₹${Math.round(totalValue).toLocaleString("en-IN")}, above the configured threshold.`,
          relatedEntityType: "Brand",
          relatedEntityId: brand.id,
        })
      )
        created++;
    }
  }
  return created;
}

async function forecastShortageAlerts(businessId: string): Promise<number> {
  const recs = await prisma.recommendation.findMany({
    where: { businessId, status: "PENDING", type: "ORDER_MORE", confidence: { in: ["HIGH", "MEDIUM"] } },
    include: { sku: { include: { product: { select: { name: true } } } } },
  });

  let created = 0;
  for (const r of recs) {
    if (
      await createIfNotOpen({
        businessId,
        type: "FORECAST_SHORTAGE",
        severity: r.confidence === "HIGH" ? "HIGH" : "MEDIUM",
        message: `${r.sku.product.name} (${r.sku.code}) is forecast to run short — recommended order: ${r.recommendedQty ?? "?"} units.`,
        relatedEntityType: "Sku",
        relatedEntityId: r.skuId,
      })
    )
      created++;
  }
  return created;
}
