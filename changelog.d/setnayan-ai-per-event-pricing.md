## 2026-07-02 · feat(setnayan-ai): per-event ₱499-intro / ₱799-renewal pricing helper (foundation)

Pure per-event pricing math for Setnayan AI — `lib/setnayan-ai-pricing.ts` (+ unit tests).
Owner-locked 2026-07-02: Setnayan AI is priced **per event** — every event's first 28-day
cycle is the **₱499 intro** (a default; admin comps/grants still override), and every 28-day
cycle after is **₱799**. `resolveSetnayanAiOrderPricePhp({ introUsed, … })` returns the
intro price on an event's first cycle and the renewal price after, re-resolving `introUsed`
from stored event state (server-authoritative — a tampered client can't force the intro on a
renewal). Both prices are read from the admin-managed catalog (`platform_retail_catalog_v2`);
the ₱499/₱799 constants are last-resort fallbacks only, honoring the "prices are
catalog-authoritative, never hardcode" lock.

Additive + inert: no migration, no buy-flow wiring, no behavior change. The per-event 28-day
window + `setnayan_ai_intro_used` flag, the renewal catalog row, the buy-flow wiring, the
public "₱499 first 28 days, then ₱799" copy, and the enabling flag land in follow-up PRs
(all default-OFF, so the live paywall is untouched until flipped).

SPEC IMPACT: Recorded. Setnayan AI is priced per event — ₱499 first 28-day cycle → ₱799/28-day
cycle after — superseding the ₱499/28d flat working price. Corpus + decision log already
updated directly (DECISION_LOG 2026-07-02; `Pricing.md` §00.A; `AS_BUILT_GROUND_TRUTH`). This
PR is the pure pricing helper only.
