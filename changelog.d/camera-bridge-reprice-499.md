## 2026-07-10 · fix(pricing): Camera Bridge reprice ₱1,299 → ₱499

Reconciles a drift found in the 2026-07-10 SEO audit. The `/pricing` Papic
estimator fallback was moved to ₱499 on 2026-07-08 (`app/pricing/page.tsx`:
`fb: 499 // owner 2026-07-08 (was 1299)`) per the owner-locked Live Studio
packaging, but the **catalog row + `llms.txt` were never updated** — both the
`/pricing` card and the estimator read the LIVE catalog rate, so they still
showed ₱1,299.

- Migration `20270711042075` (applied live): `CAMERA_BRIDGE.retail_price_php`
  1299 → 499.
- `llms.txt`: Camera Bridge line ₱1,299 → ₱499. (Drift guard green — ₱1,299
  still present via Pabati + Live Studio Mobile; ₱499 already approved.)
- `lib/v2-catalog.ts`: comment updated (stays `partial`/"In build" — the DSLR
  bridge fulfillment infra is unchanged; only the price moved).

SPEC IMPACT: DECISION_LOG row (aligns to the owner-locked 2026-07-08 figure).
