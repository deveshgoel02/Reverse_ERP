import { prisma } from "@/lib/db";

type Row = Record<string, string | number | null | undefined>;

/** One query function per report in Module P. Each returns flat rows ready for CSV export. */
export async function getReportRows(reportType: string, businessId: string): Promise<Row[]> {
  switch (reportType) {
    case "inventory":
      return inventoryReport(businessId);
    case "sales":
      return salesReport(businessId);
    case "purchases":
      return purchasesReport(businessId);
    case "dead-stock":
      return inventoryReport(businessId, "DEAD_STOCK");
    case "slow-moving":
      return inventoryReport(businessId, "SLOW_MOVING");
    case "outstanding-stock":
      return outstandingStockReport(businessId);
    case "aging":
      return agingReport(businessId);
    case "brand-performance":
      return brandPerformanceReport(businessId);
    case "sku-performance":
      return skuPerformanceReport(businessId);
    case "customers":
      return customerReport(businessId);
    case "suppliers":
      return supplierReport(businessId);
    case "forecast":
      return forecastReport(businessId);
    case "recommended-purchase":
      return recommendedPurchaseReport(businessId);
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}

async function inventoryReport(businessId: string, statusFilter?: string): Promise<Row[]> {
  const skus = await prisma.sku.findMany({
    where: { businessId, status: "ACTIVE", ...(statusFilter ? { inventory: { status: statusFilter } } : {}) },
    include: { product: { include: { brand: true, category: true } }, inventory: true },
  });
  return skus.map((s) => ({
    SKU: s.code,
    Product: s.product.name,
    Brand: s.product.brand?.name ?? "",
    Category: s.product.category?.name ?? "",
    "Current Qty": s.inventory?.currentQuantity ?? 0,
    "Inventory Value": s.inventory ? Number(s.inventory.inventoryValue) : 0,
    "Stock Age (days)": s.inventory?.stockAgeDays ?? "",
    Status: s.inventory?.status ?? "",
  }));
}

async function salesReport(businessId: string): Promise<Row[]> {
  const items = await prisma.saleItem.findMany({
    where: { sale: { businessId } },
    include: { sale: { include: { customer: true } }, sku: { include: { product: true } } },
    orderBy: { sale: { saleDate: "desc" } },
    take: 5000,
  });
  return items.map((i) => ({
    Date: i.sale.saleDate.toISOString().slice(0, 10),
    Invoice: i.sale.invoiceRef ?? "",
    Customer: i.sale.customer?.name ?? "",
    SKU: i.sku.code,
    Product: i.sku.product.name,
    Quantity: i.quantity,
    "Unit Price": Number(i.unitPrice),
    "Total Amount": Number(i.totalAmount),
  }));
}

async function purchasesReport(businessId: string): Promise<Row[]> {
  const items = await prisma.purchaseItem.findMany({
    where: { purchase: { businessId } },
    include: { purchase: { include: { supplier: true } }, sku: { include: { product: true } } },
    orderBy: { purchase: { orderDate: "desc" } },
    take: 5000,
  });
  return items.map((i) => ({
    Date: i.purchase.orderDate.toISOString().slice(0, 10),
    "PO Ref": i.purchase.invoiceRef ?? "",
    Supplier: i.purchase.supplier.name,
    SKU: i.sku.code,
    Product: i.sku.product.name,
    "Qty Ordered": i.quantityOrdered,
    "Qty Received": i.quantityReceived,
    "Unit Cost": Number(i.unitCost),
    Status: i.purchase.status,
  }));
}

async function outstandingStockReport(businessId: string): Promise<Row[]> {
  const deadlines = await prisma.stockDeadline.findMany({
    where: { businessId, status: { in: ["OPEN", "MISSED"] } },
    include: { sku: { include: { product: true, inventory: true } } },
  });
  return deadlines.map((d) => ({
    Product: d.sku.product.name,
    SKU: d.sku.code,
    "Deadline Qty": d.quantity,
    "Current Stock": d.sku.inventory?.currentQuantity ?? 0,
    Deadline: d.deadlineDate.toISOString().slice(0, 10),
    Priority: d.priority,
    Status: d.status,
  }));
}

async function agingReport(businessId: string): Promise<Row[]> {
  const skus = await prisma.sku.findMany({
    where: { businessId, status: "ACTIVE", inventory: { stockAgeDays: { not: null } } },
    include: { product: true, inventory: true },
    orderBy: { inventory: { stockAgeDays: "desc" } },
  });
  return skus.map((s) => ({
    SKU: s.code,
    Product: s.product.name,
    "Current Qty": s.inventory?.currentQuantity ?? 0,
    "Stock Age (days)": s.inventory?.stockAgeDays ?? "",
    "Last Sale": s.inventory?.lastSaleAt?.toISOString().slice(0, 10) ?? "Never",
    Status: s.inventory?.status ?? "",
  }));
}

async function brandPerformanceReport(businessId: string): Promise<Row[]> {
  const brands = await prisma.brand.findMany({ where: { businessId }, include: { products: { include: { skus: { include: { inventory: true } } } } } });
  const rows: Row[] = [];
  for (const b of brands) {
    const skus = b.products.flatMap((p) => p.skus);
    const totalQty = skus.reduce((sum, s) => sum + (s.inventory?.currentQuantity ?? 0), 0);
    const totalValue = skus.reduce((sum, s) => sum + (s.inventory ? Number(s.inventory.inventoryValue) : 0), 0);
    const totalSold = skus.reduce((sum, s) => sum + (s.inventory?.quantitySold ?? 0), 0);
    rows.push({ Brand: b.name, "SKU Count": skus.length, "Current Stock": totalQty, "Inventory Value": totalValue, "Units Sold (All Time)": totalSold });
  }
  return rows;
}

async function skuPerformanceReport(businessId: string): Promise<Row[]> {
  const skus = await prisma.sku.findMany({
    where: { businessId, status: "ACTIVE" },
    include: { product: { include: { brand: true } }, inventory: true },
  });
  return skus.map((s) => ({
    SKU: s.code,
    Product: s.product.name,
    Brand: s.product.brand?.name ?? "",
    "Qty Received": s.inventory?.quantityReceived ?? 0,
    "Qty Sold": s.inventory?.quantitySold ?? 0,
    "Current Stock": s.inventory?.currentQuantity ?? 0,
    "Sell-Through %": s.inventory && s.inventory.quantityReceived > 0
      ? Math.round((s.inventory.quantitySold / s.inventory.quantityReceived) * 100)
      : 0,
  }));
}

async function customerReport(businessId: string): Promise<Row[]> {
  const customers = await prisma.customer.findMany({ where: { businessId }, include: { sales: { include: { items: true } } } });
  return customers.map((c) => ({
    Customer: c.name,
    City: c.city ?? "",
    Orders: c.sales.length,
    "Total Spend": c.sales.reduce((sum, s) => sum + s.items.reduce((s2, i) => s2 + Number(i.totalAmount), 0), 0),
    "Last Purchase": c.sales.length > 0 ? c.sales.reduce((max, s) => (s.saleDate > max ? s.saleDate : max), c.sales[0].saleDate).toISOString().slice(0, 10) : "",
  }));
}

async function supplierReport(businessId: string): Promise<Row[]> {
  const suppliers = await prisma.supplier.findMany({ where: { businessId }, include: { purchases: { include: { items: true } } } });
  return suppliers.map((s) => ({
    Supplier: s.name,
    "Lead Time (days)": s.leadTimeDays ?? "",
    "Purchase Orders": s.purchases.length,
    "Total Ordered Value": s.purchases.reduce((sum, p) => sum + p.items.reduce((s2, i) => s2 + i.quantityOrdered * Number(i.unitCost), 0), 0),
    "Open Orders": s.purchases.filter((p) => p.status === "PENDING" || p.status === "PARTIALLY_RECEIVED").length,
  }));
}

async function forecastReport(businessId: string): Promise<Row[]> {
  const forecasts = await prisma.forecast.findMany({
    where: { businessId },
    include: { sku: { include: { product: true } } },
    orderBy: { generatedAt: "desc" },
    take: 500,
  });
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const f of forecasts) {
    if (seen.has(f.skuId)) continue; // most recent only
    seen.add(f.skuId);
    rows.push({
      SKU: f.sku.code,
      Product: f.sku.product.name,
      Method: f.method,
      "Expected Demand (next period)": f.expectedDemand,
      "Range Low": f.lowerBound,
      "Range High": f.upperBound,
      Trend: f.trend,
      Confidence: f.confidence,
    });
  }
  return rows;
}

async function recommendedPurchaseReport(businessId: string): Promise<Row[]> {
  const recs = await prisma.recommendation.findMany({
    where: { businessId, status: "PENDING", type: "ORDER_MORE" },
    include: { sku: { include: { product: { include: { supplier: true } } } } },
  });
  return recs.map((r) => ({
    SKU: r.sku.code,
    Product: r.sku.product.name,
    Supplier: r.sku.product.supplier?.name ?? "",
    "Recommended Qty": r.recommendedQty ?? 0,
    Confidence: r.confidence,
    Reason: r.reason,
  }));
}
