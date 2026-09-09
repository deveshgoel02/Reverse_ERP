# Data Import

The import wizard (`/import`) implements spec Module I's nine-step flow:

1. **Upload** — `.csv` or `.xlsx`, up to 10MB (`src/app/api/import/upload/route.ts`).
   The original file is stored as base64 (`Import.rawFileData`) — never
   discarded, even after commit.
2. **Detect structure** — `src/lib/import/parse.ts` (CSV via PapaParse,
   XLSX via ExcelJS — not the `xlsx`/SheetJS npm package, which has
   unpatched prototype-pollution/ReDoS CVEs on npm; see README "Security
   notes").
3. **Identify columns** — the parsed header row.
4–5. **Suggest mappings + confidence** — `src/lib/import/mapping.ts`. A
   token-overlap similarity score against each target field's label and a
   curated list of common real-world header aliases ("Item Code", "Qty
   Sold", "Party Name", "Purchase Dt", ...) per entity type
   (`src/lib/import/schema-fields.ts`). This is a heuristic, not ML — it's
   deliberately simple and inspectable, and every suggestion is shown to
   the owner to confirm or override before anything is validated.
6. **Validate** — `src/lib/import/normalize.ts` applies the (confirmed)
   mapping row-by-row: required fields present, numbers parse, quantities
   non-negative, dates parse (tolerant of DD-MM-YYYY, DD/MM/YYYY, ISO, and
   "15-Sep-2024" style dates — `src/lib/import/date-parse.ts`).
7. **Detect problems** — `src/lib/import/quality-checks.ts` runs cross-row
   checks (exact duplicate rows, duplicate invoice+SKU pairs, duplicate SKU
   codes within a Products file) and writes `DataQualityIssue` rows.
8. **Preview** — every row's status (VALID / WARNING / REJECTED) and the
   reason, before anything touches real tables.
9. **Import** — `src/lib/import/commit.ts` creates real records
   (Customer/Supplier/Product/Sku/Sale/Purchase + the corresponding
   InventoryMovement) for every VALID/WARNING row. One row's failure
   (e.g. a Sales row referencing a SKU that doesn't exist yet) marks only
   that row REJECTED with the reason — it never aborts the whole batch.
   After commit, `recalcInventoryForSkus()` and
   `runIntelligencePipeline()` run automatically so the dashboard reflects
   the new data immediately.

## What each entity type expects

See `src/lib/import/schema-fields.ts` for the authoritative field list
(required vs. optional, and the header aliases recognized) for SALES,
PURCHASES, INVENTORY (stock-take/opening-balance uploads), PRODUCTS,
CUSTOMERS, and SUPPLIERS.

Import order matters for referential data: a SALES or PURCHASES file
references SKUs by code, so a PRODUCTS import (or manually-created
products) must exist first, or those rows are rejected at commit with an
explicit "SKU does not exist yet" message rather than silently creating a
placeholder SKU with no pricing/brand/category.

## Product de-duplication after a Products import

Committing a PRODUCTS-type import automatically runs
`detectProductMatchCandidates()` (Module F), so if the file spells an
existing product differently ("Adidas ABC" vs. "ADIDAS-ABC"), a merge
suggestion appears at `/products/matches` rather than silently creating a
duplicate product line.

## Deliberately not built yet

- **Background/async processing for very large files.** Everything runs
  synchronously in the upload/validate/commit request. Fine at the
  thousands-of-rows scale; a 100k-row file would need a queue.
- **Resuming a partially-committed import.** If commit fails partway
  (e.g. the server restarts mid-request), already-imported rows stay
  imported (each row's status is written individually) but the Import
  header's `status` may not reflect a clean finish — re-running commit is
  safe (it only processes rows still in `VALID`/`WARNING` status) but this
  path isn't tested against a mid-commit crash.
