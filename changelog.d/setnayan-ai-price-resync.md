## 2026-06-30 · fix(pricing): re-sync public copy for Setnayan AI ₱499/28-day subscription

The catalog flip to `SETNAYAN_AI` = ₱499 per_28d (subscription) already made the
homepage + `/pricing` data-driven, but two **static-copy** surfaces still
advertised the retired ₱3,999 one-time price:

- `apps/web/public/llms.txt` — 8 statements of "Setnayan AI ₱3,999 one-time per
  event" corrected to "₱499 per 28-day cycle (subscription that runs until the
  event date)". The "₱100–₱3,999" à-la-carte range corrected to "₱100–₱3,499"
  (Live Studio multicam is now the top one-time SKU). Freshness footer dated
  2026-06-30; the single remaining "₱3,999" is the intentional history note.
- `apps/web/lib/help.ts` — the "What is Setnayan AI?" article body corrected to
  the ₱499/28-day subscription.

No price logic touched (prices stay catalog-authoritative). Verified no remaining
stale Setnayan-AI ₱3,999 references; the surviving ₱3,999 hits elsewhere are a
different SKU (Couple Website PRO), test fixtures, value-anchors, or retired SKUs.

SPEC IMPACT: None — public copy reconciled to the already-locked ₱499/28d price
(decision logged 2026-06-29).
