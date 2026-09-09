# Architecture

## Layers (matches the spec's Data → Structured Model → Intelligence philosophy)

```
Raw files (CSV/XLSX)
        │  src/lib/import/{parse,mapping,normalize,quality-checks}.ts
        ▼
Import + ImportRow (raw data preserved verbatim, lineage kept forever)
        │  src/lib/import/commit.ts
        ▼
Structured business model (Brand, Category, Product, Sku, Customer,
Supplier, Sale/SaleItem, Purchase/PurchaseItem, InventoryMovement)
        │  src/lib/inventory/recalc.ts (deterministic ledger replay)
        ▼
Inventory (cached current-state balance per SKU)
        │  src/lib/analytics/run-all.ts → runIntelligencePipeline()
        ▼
Intelligence layer (Inventory.status, Forecast, Recommendation, Alert)
        │
        ▼
UI (Dashboard, Inventory, Recommendations, Alerts, AI Copilot, Reports)
```

## The recompute pipeline

`runIntelligencePipeline(businessId)` (`src/lib/analytics/run-all.ts`) runs four
stages in order, because each reads what the previous stage wrote:

1. **Classify** (`run-classification.ts`) — reads Inventory + recent sales,
   writes `Inventory.status` (HEALTHY, SLOW_MOVING, DEAD_STOCK, ...).
2. **Forecast** (`run-forecasts.ts`) — reads monthly sales history per SKU,
   writes a `Forecast` row (method, expected demand, range, confidence).
3. **Recommend** (`run-recommendations.ts`) — reads the latest Forecast +
   Inventory.status + incoming purchase orders, writes a `Recommendation`
   row (ORDER_MORE / ORDER_LESS / MAINTAIN / DO_NOT_ORDER / REVIEW_MANUALLY).
4. **Alert** (`src/lib/alerts/generate.ts`) — reads Inventory.status,
   StockDeadline, Recommendation, and sales trend, writes `Alert` rows
   (idempotent — never duplicates an already-open alert for the same
   entity+type).

This pipeline runs automatically after every import commit
(`src/app/api/import/[id]/commit/route.ts`) and during seeding
(`prisma/seed/seed.ts`). There is no cron job wired up yet — see
**Limitations** below.

## Why deterministic engines are separate from the LLM

Every calculation that produces a number a business decision depends on —
inventory balances, forecasts, reorder recommendations, classification —
is a plain TypeScript function with no LLM involved:

- `src/lib/forecasting/forecast.ts` — statistical forecasting (moving
  average / weighted average / exponential smoothing / linear regression /
  seasonal-naive, picked by data availability).
- `src/lib/analytics/classify.ts` — stock status classification.
- `src/lib/analytics/recommend.ts` — reorder recommendation logic.
- `src/lib/inventory/recalc.ts` — inventory balance from the movement
  ledger.

These are pure functions (given the same input, always the same output),
unit-tested in `tests/`, and never call an external API. The AI Copilot
(`src/lib/ai/copilot.ts`) queries the *results* of these engines and the
database directly — an optional LLM call (`src/lib/ai/llm-client.ts`) may
rephrase the answer for readability, but never supplies the numbers.

## Auth

Custom session cookie (`src/lib/auth/session.ts`), HMAC-SHA256 via the Web
Crypto API (works identically in the Node runtime and Next.js Edge
middleware, unlike `node:crypto`). No external auth library — see README
"Why not NextAuth" for the reasoning. Passwords hashed with bcrypt
(`src/lib/auth/password.ts`).

## Multi-tenancy

Every table carries `businessId`. Shoe Xpress is currently the only row in
`Business`, but every query is already scoped by it, so onboarding a
second tenant needs no schema change — only a way to create additional
`Business`/`User` rows (not built yet, see Limitations).

## Known limitations (be honest about what's not done)

- **No background job runner.** Large imports and the recompute pipeline
  run synchronously in the request. Fine at this data volume (thousands of
  rows); would need a queue (e.g. a worker process) before tens of
  thousands of rows or very large files.
- **No multi-warehouse / location tracking.** `Sale.location` is a free-text
  field; there's no `Location` entity or per-location stock split.
- **Costing is weighted-average, not FIFO/lot-tracked.** See
  `docs/DATA_MODEL.md`.
- **No email/WhatsApp/Tally integrations** — architecture is modular
  enough to add them (Module 27 of the spec), but none are implemented.
- **Multi-tenancy is one-business-per-user.** `/signup` proves the schema's
  `businessId` isolation is real (see `src/app/api/auth/signup/route.ts`),
  but there's no membership model for one login to belong to multiple
  businesses.

## Recompute pipeline: two triggers, pick per deployment

`runIntelligencePipeline` now runs from three places:
1. After every import commit (`src/app/api/import/[id]/commit/route.ts`)
   and manual sale/purchase entry (`src/app/api/sales`, `src/app/api/purchases`).
2. An in-process scheduler (`src/instrumentation.ts`, Next's
   `register()` hook) that re-runs it for every business on an interval
   (`RECOMPUTE_INTERVAL_MINUTES`, default 6h) — this only works for a
   long-running Node process (`next start` on a VM/container); a
   serverless platform recycles the process between requests, so
   `setInterval` won't reliably fire there.
3. An HTTP endpoint (`POST /api/cron/recompute`, secret-protected via
   `CRON_SECRET`) for exactly that serverless case — point an external
   scheduler at it. This deployment uses `.github/workflows/recompute.yml`,
   a GitHub Actions scheduled workflow (every 6h + manual
   `workflow_dispatch`), chosen over a paid Render Cron Job because it's
   free and needs no third-party account. A Vercel Cron, crontab `curl`,
   or cron-job.org would work identically. All of these can run
   simultaneously without harm; the pipeline is idempotent.
