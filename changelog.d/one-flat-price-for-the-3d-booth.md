## 2026-09-05 · fix(pricing): the 3D Booth has one price — ₱3,000, every paid tier — and the couple's 3D Plan row is off sale

Owner 2026-09-05: *"yes flat prices for all of them."*

The vendor 3D Booth (`vendor_3d_booth`, 28-day branded presence in couples'
published 3D Plans) carried **three** prices at once, and a flag chose which one
a vendor was billed: the docblock owner-lock (₱1,500, 2026-07-22), the catalogue
row (₱2,500, 2026-08-27), and the tiered matrix `ads_3d_plan` band (₱2,000 entry
/ ₱1,500 growth). `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING="true"` in production
(pulled 2026-09-05), so the matrix won and the owner's catalogue figure was never
what anybody paid — exactly the reconciliation the pricing lib's own docblock said
must happen *before* that flag was switched on.

- Migration `20271205977137`: `vendor_3d_booth` → **₱3,000**; `SEATING_3D` →
  `is_active = FALSE` (the couple's 3D Plan is free, PR #5185; KWENTO precedent —
  deactivate, keep the row). Both `IS DISTINCT FROM`-scoped, idempotent.
- `VENDOR_3D_BOOTH_FALLBACK_PHP` → 3000 in the same change (the
  fallback-prices-match-the-catalog db test holds it to the row).
- `ads_3d_plan` matrix bands set **equal** (3000 / 3000), the `papic_challenge`
  rule: the flag can no longer select a price for this SKU in either state. It now
  chooses a *source*, not a number.
- `lib/llms-txt-guard-input.ts` (the hand-typed catalogue copy CI reads) marks
  `SEATING_3D` inactive, same convention as KWENTO.
- `lib/llms-txt.ts`: `SEATING_3D` leaves `REQUIRED_RETAIL` and its prose line
  now reads **free** (the LIVE_WALL / KWENTO rule — the feature exists, only the
  sale is gone). Deactivating the row alone would have thrown `RetiredSkuError`
  and dropped the whole GEO document to its stub; the guard caught it in the full
  suite before push.
- `tests/db/replay-order-is-honest.db.test.ts`: the `vendor_3d_booth` rung of the
  end-of-replay price table moves to ₱3,000 with the row — CI's full DB replay
  caught the 2,500 pin; the table is the *latest* owner figure per rung, not a
  frozen copy of the 08-27 sheet.
- Stale ₱1,500 / ₱2,000 / ₱1,500 prose on the booth card, subscription page and
  action corrected; no code path changed — both price sources agree.
- `lib/the-3d-booth-has-one-price.test.ts` pins fallback = entry = growth = 3000
  across every tier, and the fixture row off sale.
- The tier **floor** is untouched: paid plans only (`BOOTH_BRANDING_MIN_TIER`,
  owner 2026-08-29). "All of them" is every *paid* tier at one price, not the free
  tier.

The ₱500 per-event option is a separate PR (new SKU + RPC change).

SPEC IMPACT: `DECISION_LOG.md` 2026-09-05 row (couple-free + two-option vendor
pricing) already records the figures; no further corpus edit.
