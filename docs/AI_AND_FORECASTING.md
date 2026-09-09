# AI, Forecasting & Recommendations

## Principle: deterministic math, optional LLM phrasing

Spec Module 29/30 are explicit: financial/inventory numbers must never come
from an LLM. This codebase follows that literally —
`src/lib/forecasting/forecast.ts`, `src/lib/analytics/classify.ts`, and
`src/lib/analytics/recommend.ts` are plain, unit-tested TypeScript
functions with zero network calls. The only place an LLM can be invoked at
all is `src/lib/ai/llm-client.ts`, and even there it can only rephrase
wording — see below.

## Forecasting method selection

`forecastDemand()` picks a method based on how much (and how stable) the
history is — never claims more confidence than the data supports:

| History available | Method | Confidence ceiling |
|---|---|---|
| 0–1 monthly data points | `INSUFFICIENT_DATA` | LOW (explicit "not enough data" message) |
| 2–3 points | `MOVING_AVERAGE` | LOW |
| ≥4 points, no clear trend | `EXPONENTIAL_SMOOTHING` (alpha adapts to variability) | MEDIUM/HIGH by data volume & variability |
| ≥4 points, clear linear trend (R² > 0.4, slope material) | `LINEAR_REGRESSION` | MEDIUM/HIGH |
| ≥24 points (2 yearly cycles) with detected seasonality | `SEASONAL_NAIVE` (same-month average, trend-adjusted) | MEDIUM/HIGH |

Every forecast stores `inputsJson` — the historical values used, the
coefficient of variation, trend slope/R², and a human-readable note — so a
forecast can always be explained, not just displayed. The uncertainty
range (`lowerBound`/`upperBound`) is never omitted; the UI must show it
alongside the point estimate.

## Reorder recommendations

`recommendOrder()` (`src/lib/analytics/recommend.ts`) computes a reorder
point (`forecast demand during lead time + safety stock`) and compares it
to *available* stock (on-hand + already-incoming from open purchase
orders) — not just on-hand stock, which is why a SKU can show
UNDERSTOCKED physical stock but still get an ORDER_LESS recommendation if
enough is already on order. `Inventory.status` (DEAD_STOCK/AT_RISK)
overrides the pure math: the engine will never recommend ordering more of
something that isn't moving, and flags `REVIEW_MANUALLY` instead of
guessing when classification and the demand math disagree.

**The recommendation never places an order.** It's a row in the
`Recommendation` table with `status: "PENDING"` until a human accepts or
rejects it from `/recommendations` (`src/app/(app)/recommendations/`),
which is the only code path that changes its status — see spec Module 15
"AI safety".

## The AI Business Copilot

`src/lib/ai/copilot.ts` matches a natural-language question against a
fixed set of ~10 intents (keyword/regex matching — no LLM required to
route the question) and answers with a database query, not a guess. Ask it
something outside that set and it says so plainly rather than making
something up.

If `ANTHROPIC_API_KEY` is set, `maybeRephraseWithLLM()`
(`src/lib/ai/llm-client.ts`) sends the already-computed grounded answer and
its underlying data to Claude with an explicit instruction to improve
phrasing only, never change a number or fact. Any failure (no key,
network error, bad response) silently falls back to the grounded template
answer — the copilot works fully without an API key; this hasn't been
exercised against a live key in this environment (no network access
during development), so treat the LLM phrasing path as unverified
integration code, not as tested.

## Why this design, not a "just ask an LLM" chatbot

A chatbot that lets an LLM read the schema and write its own SQL (or
worse, answer from "memory") would violate the spec's core safety
requirement directly. The fixed-intent approach means every possible
answer path is auditable and testable — see `tests/import-pipeline.test.ts`
and the forecast/classify/recommend test files for what's actually
verified.
