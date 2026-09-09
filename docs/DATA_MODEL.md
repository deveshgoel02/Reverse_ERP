# Data Model

Full source of truth: `prisma/schema.prisma` (heavily commented). This is a
summary of the design decisions that aren't obvious from the schema alone.

## Provider: PostgreSQL (Neon)

See README "Database (PostgreSQL on Neon)". The schema still avoids Prisma
`enum` types entirely — a habit kept from early development against
SQLite — in favor of `String` fields validated by Zod enums in
`src/lib/enums.ts`. This means adding a new status value (e.g. a new
`AlertType`) never requires a migration — just add it to the array in
`enums.ts`.

## Inventory is a ledger, not a mutable counter

`InventoryMovement` is an append-only table — every stock change (opening
balance, purchase receipt, sale, return, damage, transfer, manual
adjustment) is one signed-quantity row. `Inventory` is a **cache**,
recomputed from scratch by replaying every movement for a SKU
(`src/lib/inventory/recalc.ts`). This means:

- Current stock can never drift from history — there's no code path that
  edits `Inventory.currentQuantity` directly.
- Every "why is this the current stock" question is answerable by reading
  the movement history (`/inventory/[id]` shows it).
- Adjustments (stock-takes, corrections) are just another movement row
  with `type: "ADJUSTMENT"`, not a special case.

The formula matches spec Module 12 exactly:
`current = opening + purchases + transfersIn + returnsIn - sales - transfersOut - returnsOut - damaged`.

**Costing simplification:** `Inventory.inventoryValue` uses a single
weighted-average cost across all `PURCHASE_RECEIPT` movements for a SKU,
not FIFO/LIFO lot tracking. For a distributor at this scale, weighted
average is standard and far simpler to reason about; lot-level costing
would need a `PurchaseLot` concept this schema doesn't have.

## Products vs. SKUs

A `Product` is the conceptual item ("Adidas Campus 00s"); a `Sku` is the
sellable unit (a specific size or colour of that product). Nearly every
transaction (sales, purchases, movements, forecasts, recommendations)
happens at the SKU level — Product exists mainly to group SKUs and hold
brand/category/gender.

## Product matching (Module F)

`ProductMatchSuggestion` holds candidate duplicate pairs
(`src/lib/catalog/product-matching.ts` — normalized-name Jaccard similarity
within the same brand). Nothing merges automatically. Confirming a match
(`src/lib/catalog/merge.ts`) reassigns every SKU from the losing product to
the surviving one and marks the loser `status: "MERGED"` with
`mergedIntoId` set — it's never deleted, so history stays traceable.

## Settings are data, not constants

Every threshold the classification/alert/recommendation engines use
(slow-moving days, dead-stock days, safety-stock days, ...) lives in
`src/lib/settings/defaults.ts` as a fallback, and can be overridden per
business (and, via `scopeType`/`scopeId`, per brand or category) in the
`Setting` table. `src/lib/settings/get.ts` resolves the layered value.
`Setting.scopeId` uses `""` as a sentinel for "no scope" rather than `NULL`
— Postgres (like most databases, and Prisma's generated compound-unique-key
type) treats NULL specially in unique constraints (two NULLs don't
conflict), so a sentinel keeps `(businessId, key, scopeType, scopeId)`
uniqueness simple and predictable.

## Audit trail

`AuditLog` records CREATE/UPDATE/DELETE/IMPORT/MERGE/ADJUST/
RECOMMENDATION_DECISION/ALERT_DISMISS actions with before/after JSON
snapshots. Every mutation that matters to the business (recommendation
accept/reject, alert dismiss, product merge, settings change, import
commit) calls `writeAuditLog()` (`src/lib/audit/log.ts`). Routine reads
don't.

## Recommendation lifecycle

`Recommendation.status`: `PENDING` → `ACCEPTED` | `REJECTED` (owner
decision) | `MODIFIED` (reserved for a future "adjust the recommended
quantity" flow) | `SUPERSEDED` (the system generated a fresher
recommendation for the same SKU before the owner acted on the old one —
distinct from REJECTED, which means the owner explicitly said no).
