## 2026-07-08 · fix(pricing): Papic add-on pricing reset — Stories/Kwento/Pabati render FREE, Camera Bridge ₱499

The homepage "Prices" popup (`app/_components/home/pricing-data.ts`) hardcoded a stale
paid ₱20 fallback for Guest Stories, and paid fallbacks for Kwento (₱299) / Pabati (₱1,299)
/ Camera Bridge (₱1,299). Per the 2026-07-08 owner pricing reset (cost-vs-value pass),
Kwento + Pabati + Stories are **FREE** and Camera Bridge is **₱499/day**.

- Added `freeOrPrice()` — renders green "Free" **only when the catalog rate resolves to 0**,
  so display ↔ checkout never diverge (no hardcoded "Free" over a live paid row).
- Fallbacks aligned: Stories / Kwento / Pabati → `0`; Camera Bridge → `499`.
- Pricing page estimator defs (`app/pricing/page.tsx`) aligned likewise; free add-ons drop
  from the estimator via the existing catalog-carried filter.

Note: live price **values** are runtime admin-catalog dials — this PR only fixes the display
fallbacks + the free-rendering guard. Owner still sets in `/admin/pricing`:
`KWENTO`=0/inactive · `PABATI`=0/inactive · `CAMERA_BRIDGE`=49900 · `AUTO_RECAP`=149900
(inactive · gate-pending the render box).

SPEC IMPACT: Applied in corpus — `Pricing.md` §00.B + §2.1, `DECISION_LOG.md` (2026-07-08),
`0012_papic/Papic_Live_Build_Plan_2026-07-08.md`.
