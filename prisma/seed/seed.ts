/**
 * Demo/dev seed data for Shoe Xpress.
 *
 * IMPORTANT: everything created here is SYNTHETIC. It exists so the UI,
 * analytics, forecasting and recommendation engines have something
 * realistic-looking to run against during development. It must never be
 * mistaken for actual Shoe Xpress business history (spec Module 22) — the
 * seeded owner account and every product/customer/supplier name below is
 * fictional or clearly a category placeholder.
 *
 * Safe to re-run: exits early if a Business already exists.
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { recalcInventoryForBusiness } from "@/lib/inventory/recalc";
import { runIntelligencePipeline } from "@/lib/analytics/run-all";
import { mulberry32, randInt, pick } from "./rng";
import { generateMonthlyDemand, type DemandPattern } from "./demand-patterns";

const SEED = 42;
const HISTORY_MONTHS = 24;
const HISTORY_START = new Date(2024, 8, 1); // Sep 2024

async function main() {
  const existing = await prisma.business.findFirst();
  if (existing) {
    console.log(`Database already has a business ("${existing.name}") — skipping seed.`);
    return;
  }

  const rng = mulberry32(SEED);
  console.log("Seeding Shoe Xpress demo data...");

  const business = await prisma.business.create({ data: { name: "Shoe Xpress" } });

  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "dhruvgoel01@gmail.com";
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "ShoeXpress@2026";
  await prisma.user.create({
    data: {
      businessId: business.id,
      email: ownerEmail.toLowerCase(),
      passwordHash: await hashPassword(ownerPassword),
      name: "Dhruv Goel",
      role: "OWNER",
    },
  });

  // ---------------------------------------------------------------------
  // Catalog: brands, categories, suppliers, customers
  // ---------------------------------------------------------------------
  const brandNames = ["Skechers", "Reebok", "Adidas", "Wildcraft"];
  const brands: Record<string, { id: string }> = {};
  for (const name of brandNames) {
    brands[name] = await prisma.brand.create({ data: { businessId: business.id, name } });
  }

  const footwear = await prisma.category.create({ data: { businessId: business.id, name: "Footwear" } });
  const bags = await prisma.category.create({ data: { businessId: business.id, name: "Bags" } });
  const subcatSeeds: [string, string][] = [
    ["Running", footwear.id],
    ["Casual", footwear.id],
    ["Training", footwear.id],
    ["Backpack", bags.id],
    ["Travel", bags.id],
    ["Daypack", bags.id],
  ];
  const subcats: Record<string, { id: string }> = {};
  for (const [name, parentId] of subcatSeeds) {
    subcats[name] = await prisma.category.create({ data: { businessId: business.id, name, parentId } });
  }

  const supplierMetro = await prisma.supplier.create({
    data: { businessId: business.id, name: "Metro Footwear Distributors", address: "Delhi", leadTimeDays: 21, phone: "011-40001234" },
  });
  const supplierWildcraft = await prisma.supplier.create({
    data: { businessId: business.id, name: "Wildcraft India Direct", leadTimeDays: 15, phone: "080-40005678" },
  });
  const supplierRegional = await prisma.supplier.create({
    data: { businessId: business.id, name: "Regional Sports Wholesale", leadTimeDays: 30, phone: "022-40009012" },
  });

  const customerNames = [
    "Anand Footwear, Karol Bagh",
    "Sunrise Shoe Palace, Pune",
    "City Sports Corner, Lucknow",
    "New Bata Road Traders, Kanpur",
    "Everest Footwear, Dehradun",
    "Metro Shoe Mart, Jaipur",
    "Shree Ganesh Sports, Nagpur",
    "Trendy Steps, Indore",
  ];
  const customers = await Promise.all(
    customerNames.map((name) =>
      prisma.customer.create({ data: { businessId: business.id, name, city: name.split(", ")[1] ?? "" } }),
    ),
  );

  // ---------------------------------------------------------------------
  // Products & SKUs
  // ---------------------------------------------------------------------
  type ProductSeed = {
    brand: string;
    name: string;
    category: string;
    gender: "MEN" | "WOMEN" | "UNISEX";
    basePurchasePrice: number;
    variants: string[]; // size or colour labels -> one SKU each
    supplier: typeof supplierMetro;
  };

  const productSeeds: ProductSeed[] = [
    { brand: "Skechers", name: "Skechers Go Walk 7", category: "Running", gender: "UNISEX", basePurchasePrice: 2200, variants: ["UK7", "UK9"], supplier: supplierMetro },
    { brand: "Skechers", name: "Skechers Flex Advantage", category: "Training", gender: "MEN", basePurchasePrice: 1900, variants: ["UK8", "UK10"], supplier: supplierMetro },
    { brand: "Skechers", name: "Skechers D'Lites", category: "Casual", gender: "WOMEN", basePurchasePrice: 2100, variants: ["UK5", "UK7"], supplier: supplierMetro },
    { brand: "Skechers", name: "Skechers Summits", category: "Training", gender: "MEN", basePurchasePrice: 2400, variants: ["UK8", "UK9"], supplier: supplierMetro },
    { brand: "Reebok", name: "Reebok Classic Leather", category: "Casual", gender: "UNISEX", basePurchasePrice: 1900, variants: ["UK7", "UK9"], supplier: supplierMetro },
    { brand: "Reebok", name: "Reebok Club C 85", category: "Casual", gender: "MEN", basePurchasePrice: 2000, variants: ["UK8", "UK10"], supplier: supplierRegional },
    { brand: "Reebok", name: "Reebok Nano X3", category: "Training", gender: "MEN", basePurchasePrice: 3200, variants: ["UK8", "UK9"], supplier: supplierRegional },
    { brand: "Reebok", name: "Reebok Floatride Energy", category: "Running", gender: "WOMEN", basePurchasePrice: 2600, variants: ["UK5", "UK7"], supplier: supplierMetro },
    { brand: "Adidas", name: "Adidas Campus 00s", category: "Casual", gender: "UNISEX", basePurchasePrice: 3400, variants: ["UK7", "UK9"], supplier: supplierMetro },
    { brand: "Adidas", name: "Adidas Superstar", category: "Casual", gender: "UNISEX", basePurchasePrice: 3100, variants: ["UK6", "UK8"], supplier: supplierMetro },
    { brand: "Adidas", name: "Adidas Ultraboost Light", category: "Running", gender: "MEN", basePurchasePrice: 4800, variants: ["UK8", "UK10"], supplier: supplierRegional },
    { brand: "Adidas", name: "Adidas Duramo SL", category: "Running", gender: "WOMEN", basePurchasePrice: 2300, variants: ["UK5", "UK7"], supplier: supplierMetro },
    { brand: "Wildcraft", name: "Wildcraft Trail Backpack 35L", category: "Backpack", gender: "UNISEX", basePurchasePrice: 1400, variants: ["Black", "Grey"], supplier: supplierWildcraft },
    { brand: "Wildcraft", name: "Wildcraft Voyager Duffel", category: "Travel", gender: "UNISEX", basePurchasePrice: 1200, variants: ["Black", "Navy"], supplier: supplierWildcraft },
    { brand: "Wildcraft", name: "Wildcraft Compact Daypack", category: "Daypack", gender: "UNISEX", basePurchasePrice: 900, variants: ["Black", "Red"], supplier: supplierWildcraft },
    { brand: "Wildcraft", name: "Wildcraft Laptop Backpack Pro", category: "Backpack", gender: "UNISEX", basePurchasePrice: 1700, variants: ["Black", "Grey"], supplier: supplierWildcraft },
  ];

  const patterns: DemandPattern[] = ["GROWING", "DECLINING", "STABLE", "DEAD", "SEASONAL", "ERRATIC"];

  type SkuRecord = {
    id: string;
    code: string;
    productName: string;
    purchasePrice: number;
    sellingPrice: number;
    supplierId: string;
    pattern: DemandPattern;
    seedIndex: number;
  };
  const skuRecords: SkuRecord[] = [];
  let seedIndex = 0;

  for (const p of productSeeds) {
    const product = await prisma.product.create({
      data: {
        businessId: business.id,
        name: p.name,
        brandId: brands[p.brand].id,
        categoryId: subcats[p.category].id,
        gender: p.gender,
        supplierId: p.supplier.id,
      },
    });

    for (const variant of p.variants) {
      const purchasePrice = p.basePurchasePrice + randInt(rng, -100, 100);
      const sellingPrice = Math.round(purchasePrice / 0.62);
      const mrp = Math.round(sellingPrice * 1.15);
      const isSize = /^UK/.test(variant);
      const productPart = p.name
        .replace(new RegExp(`^${p.brand}\\s*`, "i"), "")
        .replace(/[^A-Za-z0-9]/g, "")
        .slice(0, 10)
        .toUpperCase();
      const code = `${p.brand.slice(0, 3).toUpperCase()}-${productPart}-${variant.replace(/\s/g, "")}`;

      const sku = await prisma.sku.create({
        data: {
          businessId: business.id,
          productId: product.id,
          code,
          size: isSize ? variant : null,
          color: isSize ? null : variant,
          purchasePrice,
          sellingPrice,
          mrp,
          minOrderQty: 10,
        },
      });

      skuRecords.push({
        id: sku.id,
        code: sku.code,
        productName: p.name,
        purchasePrice,
        sellingPrice,
        supplierId: p.supplier.id,
        pattern: pick(rng, patterns),
        seedIndex: seedIndex++,
      });
    }
  }

  console.log(`Created ${skuRecords.length} SKUs across ${productSeeds.length} products.`);

  // ---------------------------------------------------------------------
  // Purchases + inventory movements (opening balance + periodic receipts)
  // ---------------------------------------------------------------------
  type MovementInput = {
    businessId: string;
    skuId: string;
    type: string;
    quantity: number;
    unitCost: number | null;
    referenceType: string | null;
    referenceId: string | null;
    note: string | null;
    occurredAt: Date;
  };
  const movements: MovementInput[] = [];

  const demandBySku = new Map<string, number[]>();
  for (const sku of skuRecords) {
    const monthly = Array.from({ length: HISTORY_MONTHS }, (_, i) =>
      generateMonthlyDemand(sku.pattern, i, HISTORY_MONTHS, sku.seedIndex),
    );
    demandBySku.set(sku.id, monthly);
  }

  let purchaseCounter = 1000;
  for (const sku of skuRecords) {
    const monthly = demandBySku.get(sku.id)!;
    const openingDate = new Date(HISTORY_START);
    openingDate.setDate(openingDate.getDate() - 20);
    const openingQty = Math.max(20, Math.ceil((monthly.slice(0, 3).reduce((a, b) => a + b, 0) || 15) * 1.6));

    movements.push({
      businessId: business.id,
      skuId: sku.id,
      type: "OPENING",
      quantity: openingQty,
      unitCost: sku.purchasePrice,
      referenceType: "Manual",
      referenceId: null,
      note: "Opening balance (seed)",
      occurredAt: openingDate,
    });

    let runningStock = openingQty;
    for (let m = 0; m < HISTORY_MONTHS; m++) {
      const demand = monthly[m];
      const monthDate = new Date(HISTORY_START.getFullYear(), HISTORY_START.getMonth() + m, 1);

      if (runningStock < demand * 1.5 && sku.pattern !== "DEAD") {
        const orderQty = Math.max(20, Math.ceil(demand * 3.2));
        const orderDate = new Date(monthDate);
        orderDate.setDate(3);
        purchaseCounter++;

        const purchase = await prisma.purchase.create({
          data: {
            businessId: business.id,
            supplierId: sku.supplierId,
            invoiceRef: `PO-${purchaseCounter}`,
            orderDate,
            expectedDeliveryDate: addDays(orderDate, 10),
            status: "RECEIVED",
            items: {
              create: [{ skuId: sku.id, quantityOrdered: orderQty, quantityReceived: orderQty, unitCost: sku.purchasePrice }],
            },
          },
        });

        movements.push({
          businessId: business.id,
          skuId: sku.id,
          type: "PURCHASE_RECEIPT",
          quantity: orderQty,
          unitCost: sku.purchasePrice,
          referenceType: "Purchase",
          referenceId: purchase.id,
          note: null,
          occurredAt: addDays(orderDate, 8),
        });
        runningStock += orderQty;
      }
      runningStock -= demand;
    }
  }

  // A handful of currently-open purchases: one overdue (triggers SUPPLIER_DELAY),
  // a couple recent and still within lead time (populate "incoming stock").
  const openPoTargets = skuRecords.filter((_, i) => i % 6 === 0).slice(0, 5);
  for (const [i, sku] of openPoTargets.entries()) {
    const orderDate = addDays(new Date(), i === 0 ? -35 : -5);
    purchaseCounter++;
    await prisma.purchase.create({
      data: {
        businessId: business.id,
        supplierId: sku.supplierId,
        invoiceRef: `PO-${purchaseCounter}`,
        orderDate,
        expectedDeliveryDate: addDays(orderDate, i === 0 ? 15 : 20), // first one is now overdue
        status: "PENDING",
        items: { create: [{ skuId: sku.id, quantityOrdered: 60, quantityReceived: 0, unitCost: sku.purchasePrice }] },
      },
    });
  }

  // ---------------------------------------------------------------------
  // Sales (grouped into invoices) + sale movements
  // ---------------------------------------------------------------------
  type MonthSaleEntry = { skuId: string; quantity: number; sellingPrice: number };
  const salesByMonth = new Map<string, MonthSaleEntry[]>();
  for (const sku of skuRecords) {
    const monthly = demandBySku.get(sku.id)!;
    for (let m = 0; m < HISTORY_MONTHS; m++) {
      if (monthly[m] <= 0) continue;
      const key = `${m}`;
      const entry = { skuId: sku.id, quantity: monthly[m], sellingPrice: sku.sellingPrice };
      if (!salesByMonth.has(key)) salesByMonth.set(key, []);
      salesByMonth.get(key)!.push(entry);
    }
  }

  let invoiceCounter = 5000;
  for (const [monthKey, entries] of salesByMonth) {
    const m = Number(monthKey);
    const monthDate = new Date(HISTORY_START.getFullYear(), HISTORY_START.getMonth() + m, 1);
    const shuffled = [...entries].sort(() => rng() - 0.5);

    let i = 0;
    while (i < shuffled.length) {
      const chunkSize = randInt(rng, 1, 3);
      const chunk = shuffled.slice(i, i + chunkSize);
      i += chunkSize;

      const saleDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(rng, 1, 27));
      invoiceCounter++;
      const customer = pick(rng, customers);

      const items = chunk.map((c) => {
        const totalAmount = c.quantity * c.sellingPrice;
        return {
          skuId: c.skuId,
          quantity: c.quantity,
          unitPrice: c.sellingPrice,
          discount: 0,
          tax: Math.round(totalAmount * 0.05),
          totalAmount: totalAmount + Math.round(totalAmount * 0.05),
        };
      });

      const sale = await prisma.sale.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          invoiceRef: `INV-${invoiceCounter}`,
          saleDate,
          salesperson: "Counter Sale",
          items: { create: items },
        },
        include: { items: true },
      });

      for (const item of sale.items) {
        movements.push({
          businessId: business.id,
          skuId: item.skuId,
          type: "SALE",
          quantity: -item.quantity,
          unitCost: null,
          referenceType: "Sale",
          referenceId: sale.id,
          note: null,
          occurredAt: saleDate,
        });
      }
    }
  }

  console.log(`Prepared ${movements.length} inventory movements; writing to DB...`);
  // SQLite (via better-sqlite3) has a bound-parameter ceiling, so createMany in batches.
  const BATCH = 200;
  for (let i = 0; i < movements.length; i += BATCH) {
    await prisma.inventoryMovement.createMany({ data: movements.slice(i, i + BATCH) as never });
  }

  // ---------------------------------------------------------------------
  // Stock deadlines (Module C)
  // ---------------------------------------------------------------------
  const deadlineTargets = skuRecords.filter((_, i) => i % 5 === 0);
  for (const [i, sku] of deadlineTargets.entries()) {
    const daysOut = [40, 25, 10, -5, 60][i % 5];
    await prisma.stockDeadline.create({
      data: {
        businessId: business.id,
        skuId: sku.id,
        quantity: randInt(rng, 20, 60),
        deadlineDate: addDays(new Date(), daysOut),
        priority: daysOut < 15 ? "HIGH" : "NORMAL",
        status: "OPEN",
        notes: "Seed demo deadline",
      },
    });
  }

  // ---------------------------------------------------------------------
  // Legacy sparse historical data — demonstrates gap-tolerant analytics
  // and import lineage (spec Module 3 / Module I), without fabricating a
  // full 15-20 year density the business may not actually have.
  // ---------------------------------------------------------------------
  const legacySku = skuRecords[0];
  const legacyImport = await prisma.import.create({
    data: {
      businessId: business.id,
      filename: "legacy_sales_2016.xlsx",
      fileType: "XLSX",
      entityType: "SALES",
      status: "IMPORTED",
      totalRows: 2,
      successfulRows: 2,
      rejectedRows: 0,
      warningRows: 0,
      completedAt: new Date("2016-11-20"),
    },
  });
  await prisma.importRow.createMany({
    data: [
      {
        importId: legacyImport.id,
        rowNumber: 1,
        rawData: { "Item Code": legacySku.code, "Qty Sold": 12, "Sale Dt": "18-11-2016" },
        normalizedData: { skuCode: legacySku.code, quantity: 12, saleDate: "2016-11-18" },
        status: "IMPORTED",
      },
      {
        importId: legacyImport.id,
        rowNumber: 2,
        rawData: { "Item Code": legacySku.code, "Qty Sold": 8, "Sale Dt": "29-11-2016" },
        normalizedData: { skuCode: legacySku.code, quantity: 8, saleDate: "2016-11-29" },
        status: "IMPORTED",
      },
    ],
  });
  const legacyCustomer = customers[0];
  const legacySale = await prisma.sale.create({
    data: {
      businessId: business.id,
      customerId: legacyCustomer.id,
      invoiceRef: "INV-LEGACY-2016-1",
      saleDate: new Date("2016-11-18"),
      items: { create: [{ skuId: legacySku.id, quantity: 12, unitPrice: legacySku.sellingPrice, totalAmount: 12 * legacySku.sellingPrice }] },
    },
  });
  await prisma.inventoryMovement.create({
    data: {
      businessId: business.id,
      skuId: legacySku.id,
      type: "SALE",
      quantity: -12,
      referenceType: "Sale",
      referenceId: legacySale.id,
      occurredAt: new Date("2016-11-18"),
      note: "From legacy import lineage (2016)",
    },
  });

  // ---------------------------------------------------------------------
  // Recompute derived state: inventory balances, then the full intelligence pipeline.
  // ---------------------------------------------------------------------
  console.log("Recalculating inventory balances...");
  await recalcInventoryForBusiness(business.id);

  console.log("Running classification / forecasting / recommendations / alerts...");
  const pipelineResult = await runIntelligencePipeline(business.id);
  console.log(pipelineResult);

  console.log("\nSeed complete.");
  console.log(`Login: ${ownerEmail} / ${ownerPassword}`);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
