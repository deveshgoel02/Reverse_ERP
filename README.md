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
  attention today, what to order more/less of. Includes a 12-month sales
  trend line chart and an inventory-value-by-brand bar chart (Recharts),
  built per the dataviz skill's validated palette and mark specs.
- **Scheduled recompute** — the intelligence pipeline re-runs automatically
  for every business on an interval (`src/instrumentation.ts`, default
  every 6 hours) even with no new imports/transactions, so stock aging and
  alerts stay current purely from time passing. A secret-protected HTTP
  endpoint (`POST /api/cron/recompute`) is also available for serverless
  deployments where an external scheduler (Vercel Cron, GitHub Actions,
  etc.) is a better fit than an in-process interval.
- **Manual sale/purchase entry** — `/sales/new` and `/purchases/new`, with
  dynamic multi-line-item invoices, live price pre-fill from the SKU
  master, and the same movement-ledger/audit-log guarantees as the bulk
  import path (they share the underlying creation logic).
- **Multi-tenant signup** — `/signup` creates a brand-new, fully isolated
  business + owner account (proving `businessId` scoping is real, not
  aspirational — verified in a live browser session: a second tenant sees
  zero of Shoe Xpress's data). Shoe Xpress is the first tenant, not a
  hardcoded assumption — the sidebar/dashboard show each tenant's own
  business name.

## What's not built (honest limitations)

- No background job queue — imports and the recompute pipeline run
  synchronously; fine at thousands-of-rows scale, would need work before
  tens of thousands.
- No multi-warehouse/location tracking.
- The in-process scheduler only helps a long-running Node process
  (`next start` on a VM/container) — on serverless platforms use the
  `/api/cron/recompute` HTTP endpoint with an external scheduler instead
  (both are implemented; pick whichever matches your deployment).
- No WhatsApp/Tally/POS/barcode integrations (architecture is modular
  enough to add them later, per spec Module 27, but none exist yet).
- The optional Claude-powered copilot phrasing layer hasn't been
  exercised against a live API key in this environment (no network access
  during development) — the code path has a tested, always-working
  fallback, but treat the LLM call itself as unverified.
- No PDF export (CSV only) — see "Reports" above.
- Costing is weighted-average, not FIFO/lot-tracked (see `docs/DATA_MODEL.md`).
- Multi-tenancy is one-business-per-user (a `User` belongs to exactly one
  `Business`); there's no membership model for one login to access
  multiple businesses.

## Tech stack, and why

| Choice | Reasoning |
|---|---|
| Next.js 16 (App Router) + React 19 + TypeScript | Spec's stated preference; server components keep data-heavy pages simple. |
| **PostgreSQL on Neon** | Serverless Postgres with instant branching — dev, test, and production each get their own database on the same Neon project (see "Database (PostgreSQL on Neon)" below), and Neon's Vercel integration keeps `DATABASE_URL` in sync automatically. The schema still avoids native Prisma enums and Postgres-only types (`src/lib/enums.ts` + Zod instead) — a portability habit kept from when this ran on SQLite during early development, not a requirement anymore. |
| Prisma 7 (driver-adapter based) | Mature ORM; Prisma 7 changed how datasource config works (`prisma.config.ts` + a driver adapter in `src/lib/db.ts`) — see the comments in `prisma.config.ts` if this looks unfamiliar. |
| Zod | Runtime validation, and the source of truth for every "enum" (see `src/lib/enums.ts`) — adding a new status value never needs a migration. |
| Tailwind CSS v4 | Utility-first styling, no heavy component library dependency. |
| Recharts | Dashboard sales-trend and brand-value charts. |
| ExcelJS + PapaParse | XLSX/CSV parsing. **Not** the `xlsx` (SheetJS) npm package — it has unpatched prototype-pollution and ReDoS CVEs on the npm registry, which matters directly here since this app parses arbitrary user-uploaded files. |
| bcryptjs + a custom HMAC session cookie (Web Crypto API) | No NextAuth — a hand-rolled, small, fully-understood auth path avoids pulling in a library with version-compatibility uncertainty against a very new Next.js major version, and the requirements (single-tenant-per-login, simple roles) don't need NextAuth's provider ecosystem. The session implementation uses `crypto.subtle` (Web Crypto) rather than `node:crypto` so the same code works in both the Node runtime and Next's Edge middleware. |
| Vitest | Fast, native ESM/TS support, no config ceremony. |

## Running locally

```bash
npm install
cp .env.example .env          # already done in this repo — fill in DATABASE_URL/TEST_DATABASE_URL and AUTH_SECRET
npm run db:migrate            # applies migrations to your dev database
npm run db:seed               # loads clearly-synthetic demo data (see prisma/seed/seed.ts)
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`.

**Demo login:** `vrekhagoel@gmail.com` / `ShoeXpress@2026` (or whatever
`SEED_OWNER_EMAIL`/`SEED_OWNER_PASSWORD` were set to before seeding). Or
create a brand-new, empty business at `/signup`.

### Database (PostgreSQL on Neon)

This app runs on Postgres end to end — no SQLite fallback. Locally it uses
[Neon](https://neon.tech) (serverless Postgres, generous free tier), with
three separate databases under one Neon project so environments never mix:

| Database | Used by |
|---|---|
| `<name>` (e.g. `neondb`) | Production (the deployed app) |
| `<name>_dev` | Local development (`npm run dev`) |
| `<name>_test` | The automated test suite (`npm test`) |

All three share one Neon project/branch and one Postgres role — only the
database name in the connection string differs. Any Postgres works here,
not just Neon (Supabase, RDS, a local `postgres` install, etc.) — Neon is
simply what this instance is configured against.

To point the app at your own Postgres: set `DATABASE_URL` (app/dev) and
`TEST_DATABASE_URL` (test suite) in `.env`, then `npm run db:migrate`.

### Environment variables

See `.env.example`. `DATABASE_URL` and `AUTH_SECRET` are required;
`TEST_DATABASE_URL` is required to run the test suite; `ANTHROPIC_API_KEY`
is optional (copilot works without it); `CRON_SECRET` guards the
`/api/cron/recompute` endpoint (see "Scheduled recompute" above).

### Running tests

```bash
npm test          # runs the full suite once (pretest applies migrations to TEST_DATABASE_URL)
npm run test:watch
```

63 tests across 7 files, run against a real Postgres database (not
mocked): forecasting engine, stock classification, reorder recommendations,
inventory ledger recalculation (integration), the import pipeline
(mapping/normalization/date-parsing/data-quality), product de-duplication
(integration), and manual sale/purchase entry (integration —
ordered-vs-received status transitions, cross-business rejection). Network
round-trips to a remote database make these noticeably slower than an
in-process SQLite suite would be (~2 minutes total) — `testTimeout` is set
accordingly in `vitest.config.mts`.

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

**Live at https://shoe-xpress-erp.vercel.app** — Vercel (app) + Neon
(database) + a scheduled GitHub Actions workflow (recompute heartbeat).
This is a single Next.js project — pages and API routes together — so
there's no separate frontend/backend deploy; Vercel is the native platform
for the whole thing.

- **Neon** — the database, see "Database (PostgreSQL on Neon)" above.
  Production uses `shoexpress_prod`, its own database, separate from
  dev/test. Note: the Neon *project* this app lives in ("shoexpress") had
  a pre-existing, unrelated, populated database (`neondb`) under it from
  another project reusing the same Neon project — that database was left
  untouched; `shoexpress_prod`/`_dev`/`_test` were created fresh
  specifically for this app.
- **Vercel** — imports the GitHub repo, builds and serves the full app
  (`next build`, all `/api/*` routes as serverless functions). Env vars
  set in the Vercel project: `DATABASE_URL` (Neon production connection
  string), `AUTH_SECRET`, `CRON_SECRET`, and optionally
  `ANTHROPIC_API_KEY`. `DISABLE_RECOMPUTE_SCHEDULER=true` is set here too
  — Vercel's serverless functions don't keep a process alive between
  requests, so the in-process scheduler (`src/instrumentation.ts`) can't
  fire reliably there; the scheduled workflow below is used instead.
  Requires a `postinstall: prisma generate` script (see `package.json`) —
  without it the build fails on a fresh `npm install` with a
  `.prisma/client/default` module-not-found error, since the generated
  client is (correctly) never committed.
- **`.github/workflows/recompute.yml`** — a GitHub Actions scheduled
  workflow (every 6 hours + manual `workflow_dispatch`) that calls the
  deployed app's `POST /api/cron/recompute` with the `CRON_SECRET` repo
  secret in the `x-cron-secret` header. Free (no third-party account, no
  payment method needed) — chosen over a paid Render Cron Job for exactly
  that reason. This is what keeps stock aging/alerts/forecasts fresh for
  SKUs that go quiet (no new sales/purchases) — everything else recomputes
  automatically on import/sale/purchase regardless of this workflow; see
  `docs/ARCHITECTURE.md` "Recompute pipeline" for what breaks (nothing
  critical) if it's ever disabled.

For a different deployment shape (e.g. a single long-running server instead
of Vercel): set `AUTH_SECRET`/`DATABASE_URL`, leave
`DISABLE_RECOMPUTE_SCHEDULER` unset, and run `npm run build && npm start`
behind HTTPS — the in-process scheduler handles recompute on its own then,
and the scheduled workflow becomes unnecessary (though harmless to leave
running). Nothing in the codebase is tied to Vercel specifically.
