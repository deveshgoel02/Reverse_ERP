# Shoe Xpress — Reverse ERP / AI Inventory Intelligence Platform

An inventory intelligence system for Shoe Xpress, a footwear/backpack
distributor (Skechers, Reebok, Adidas, Wildcraft). Instead of forcing the
business to re-enter data into a conventional ERP, the philosophy is
reversed: import the business's existing (often messy) Excel/CSV records,
and let the system build structured data and business intelligence from
them — stock classification, demand forecasting, reorder recommendations,
alerts, and a grounded natural-language copilot.

See `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/AI_AND_FORECASTING.md`,
and `docs/DATA_IMPORT.md` for the deeper design notes referenced throughout
this file.

## What's actually implemented

Everything below is real, working code — not a scaffold. It has been
built, type-checked, linted, unit/integration tested, and exercised in a
real browser session against seeded data.

- **Auth** — email/password login, HMAC-signed session cookies, role-based
  access (OWNER/MANAGER/STAFF/VIEWER).
- **Catalog** — Brands, Categories (with subcategories), Products, SKUs
  (size/colour variants), Customers, Suppliers.
- **Inventory** — deterministic ledger-based stock tracking (every stock
  change is a movement row; current balance is always a replay of the
  ledger, never hand-edited), inventory value, stock aging, per-SKU
  movement history.
- **Sales & Purchases** — transaction records, ordered-vs-received
  tracking, outstanding purchase orders.
- **Stock Deadlines** — assign expected-movement dates to stock, with
  automatic approaching/missed alerts.
- **Historical data import** — a full upload → column-mapping-with-
  confidence → validate → preview → commit pipeline for Sales, Purchases,
  Inventory (stock-take), Products, Customers, and Suppliers files. Raw
  files are preserved; nothing is silently overwritten. See
  `docs/DATA_IMPORT.md`.
- **Data quality engine** — duplicate/missing-field/invalid-date/negative-
  quantity detection, surfaced before commit.
- **Product de-duplication** — fuzzy-matches differently-spelled versions
  of the same product ("Adidas ABC" / "ADIDAS-ABC") and lets the owner
  confirm or reject a merge; never auto-merges.
- **Stock classification** — HEALTHY / FAST_MOVING / SLOW_MOVING /
  AT_RISK / DEAD_STOCK / OVERSTOCKED / UNDERSTOCKED / OUT_OF_STOCK, every
  threshold configurable from Settings, not hard-coded.
- **Demand forecasting** — a real statistical engine (moving average,
  weighted average, exponential smoothing, linear regression, seasonal-
  naive), method chosen by data availability, always with an explicit
  confidence level and uncertainty range. See `docs/AI_AND_FORECASTING.md`.
- **Reorder recommendations** — ORDER_MORE / ORDER_LESS / MAINTAIN /
  DO_NOT_ORDER / REVIEW_MANUALLY, each with the full numeric reasoning
  attached, always advisory (never places an order), always logged.
- **Alert engine** — low stock, overstock, dead stock, aging, deadline
  approaching/missed, sales decline/spike, supplier delay, forecast
  shortage, high brand exposure. Idempotent (won't spam duplicate alerts).
- **AI Business Copilot** — natural-language Q&A grounded entirely in
  database queries (never an LLM guessing numbers); works fully without
  any API key, with an optional Claude-powered phrasing layer if
  `ANTHROPIC_API_KEY` is set. See `docs/AI_AND_FORECASTING.md`.
- **Reports** — 13 CSV exports (inventory, sales, purchases, dead stock,
  slow-moving, aging, brand/SKU performance, customers, suppliers,
  forecast, recommended purchases, outstanding stock).
- **Audit log** — every recommendation decision, alert dismissal, product
  merge, and settings change is recorded with before/after values.
- **Settings** — every classification/alert/recommendation threshold is
  owner-configurable, not hard-coded.
- **Executive dashboard** — answers the 7 questions the spec calls out:
  how much stock, what's stuck, what's selling fastest/slowest, what needs
  attention today, what to order more/less of.

## What's not built (honest limitations)

- No background job queue — imports and the recompute pipeline run
  synchronously; fine at thousands-of-rows scale, would need work before
  tens of thousands.
- No multi-warehouse/location tracking.
- No scheduled (e.g. nightly) recompute — the intelligence pipeline runs
  after imports and during seeding, not on a timer.
- No WhatsApp/Tally/POS/barcode integrations (architecture is modular
  enough to add them later, per spec Module 27, but none exist yet).
- Minimal manual sale/purchase entry forms — the primary path for getting
  transaction data in is the import wizard, matching the reverse-ERP
  philosophy; dedicated one-off manual-entry forms aren't built.
- The optional Claude-powered copilot phrasing layer hasn't been
  exercised against a live API key in this environment (no network access
  during development) — the code path has a tested, always-working
  fallback, but treat the LLM call itself as unverified.
- No PDF export (CSV only) — see "Reports" above.
- Costing is weighted-average, not FIFO/lot-tracked (see `docs/DATA_MODEL.md`).

## Tech stack, and why

| Choice | Reasoning |
|---|---|
| Next.js 16 (App Router) + React 19 + TypeScript | Spec's stated preference; server components keep data-heavy pages simple. |
| **SQLite for local dev, PostgreSQL for production** | No PostgreSQL server or Docker was available in the build environment. Rather than ship an untested Postgres schema, the schema was written to be portable (no native enums, no Postgres-only types) and actually run end-to-end against SQLite. See "Switching to PostgreSQL" below. |
| Prisma 7 (driver-adapter based) | Mature ORM; Prisma 7 changed how datasource config works (`prisma.config.ts` + a driver adapter in `src/lib/db.ts`) — see the comments in `prisma.config.ts` if this looks unfamiliar. |
| Zod | Runtime validation, and the source of truth for every "enum" (see `src/lib/enums.ts`) since SQLite doesn't support native enums. |
| Tailwind CSS v4 | Utility-first styling, no heavy component library dependency. |
| Recharts | Installed for future chart work (not yet used in a page). |
| ExcelJS + PapaParse | XLSX/CSV parsing. **Not** the `xlsx` (SheetJS) npm package — it has unpatched prototype-pollution and ReDoS CVEs on the npm registry, which matters directly here since this app parses arbitrary user-uploaded files. |
| bcryptjs + a custom HMAC session cookie (Web Crypto API) | No NextAuth — a hand-rolled, small, fully-understood auth path avoids pulling in a library with version-compatibility uncertainty against a very new Next.js major version, and the requirements (single-tenant-per-login, simple roles) don't need NextAuth's provider ecosystem. The session implementation uses `crypto.subtle` (Web Crypto) rather than `node:crypto` so the same code works in both the Node runtime and Next's Edge middleware. |
| Vitest | Fast, native ESM/TS support, no config ceremony. |

## Running locally

```bash
npm install
cp .env.example .env          # already done in this repo; edit AUTH_SECRET for a real deployment
npx prisma migrate deploy     # applies migrations to prisma dev.db (or run `npm run db:migrate` in dev)
npm run db:seed               # loads clearly-synthetic demo data (see prisma/seed/seed.ts)
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`.

**Demo login:** `dhruvgoel01@gmail.com` / `ShoeXpress@2026` (or whatever
`SEED_OWNER_EMAIL`/`SEED_OWNER_PASSWORD` were set to before seeding).

### Environment variables

See `.env.example`. `DATABASE_URL` and `AUTH_SECRET` are required;
`ANTHROPIC_API_KEY` is optional (copilot works without it).

### Switching to PostgreSQL

1. In `prisma/schema.prisma`, change `provider = "sqlite"` to
   `provider = "postgresql"` in the `datasource db` block.
2. Set `DATABASE_URL` to a Postgres connection string.
3. In `src/lib/db.ts`, swap `@prisma/adapter-better-sqlite3` for
   `@prisma/adapter-pg` (`npm install @prisma/adapter-pg pg`) and update
   `createClient()` to construct that adapter with the connection string
   instead of a file path.
4. Delete `prisma/migrations/` and run `npx prisma migrate dev --name init`
   against the new database (SQLite and Postgres migration SQL aren't
   interchangeable — this schema was never modified in a way that should
   need it, but a fresh migration is the safe path).
5. Update `prisma.config.ts`'s `datasource.url` reference if needed (it
   already reads from `env("DATABASE_URL")`, so this is usually a no-op).

### Running tests

```bash
npm test          # runs the full suite once (pretest bootstraps a throwaway prisma/test.db)
npm run test:watch
```

56 tests across 6 files: forecasting engine, stock classification, reorder
recommendations, inventory ledger recalculation (integration, against a
real SQLite DB), the import pipeline (mapping/normalization/date-parsing/
data-quality), and product de-duplication (integration).

### Other scripts

```bash
npm run build          # production build (also runs TypeScript checking)
npm run lint            # ESLint
npm run db:migrate      # prisma migrate dev
npm run db:generate     # prisma generate
npm run db:studio       # prisma studio (visual DB browser)
```

## How inventory is calculated

Deterministically, from an append-only movement ledger — see
`docs/DATA_MODEL.md` "Inventory is a ledger, not a mutable counter" and
`src/lib/inventory/recalc.ts`. No LLM or heuristic is ever involved in a
stock-balance number.

## How stock classification works

See `docs/DATA_MODEL.md` and `src/lib/analytics/classify.ts`. Every
threshold (slow-moving days, dead-stock days, overstock day-cover, ...)
is owner-configurable from `/settings`, resolved through
`src/lib/settings/get.ts` (business-wide, with optional brand/category
overrides) — nothing is hard-coded.

## How forecasting works

See `docs/AI_AND_FORECASTING.md`.

## How reorder recommendations work

See `docs/AI_AND_FORECASTING.md`.

## How the AI Copilot works

See `docs/AI_AND_FORECASTING.md` — grounded database queries first,
optional LLM rephrasing second, and the LLM can never touch a number.

## Security considerations

- Passwords hashed with bcrypt (12 rounds), never logged or returned by
  any API.
- Session cookies are `httpOnly`, `sameSite: lax`, and `secure` in
  production.
- All routes except `/login` and the login/logout API are protected by
  `src/proxy.ts` (Next 16's middleware — note the file is named `proxy.ts`
  per Next 16's renamed convention, not `middleware.ts`).
- Every Prisma query is scoped by `businessId` from the authenticated
  session — never trusts a client-supplied business/tenant id.
- File imports use ExcelJS/PapaParse rather than the vulnerable `xlsx`
  npm package (see tech stack table above) and cap upload size at 10MB.
- `.env` is git-ignored; `.env.example` documents every variable with no
  real secrets.
- No secrets are logged; Prisma errors are returned to the client as
  generic messages in production paths, not raw stack traces.

## Deployment

Not deployed anywhere yet. For a real deployment: provision PostgreSQL
(see "Switching to PostgreSQL"), set `AUTH_SECRET` to a real random value,
set `NODE_ENV=production`, and run `npm run build && npm start` behind
HTTPS. A managed Postgres + a platform like Railway/Render/Fly or a VM
would all work; nothing in this codebase is platform-specific.
