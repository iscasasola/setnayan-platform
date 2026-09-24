## 2026-09-24 · feat(pricing): Event Hub Pro also unlocks the logo animation

Owner ruling 2026-09-24 ("A then"): Event Hub Pro (`COUPLE_WEBSITE_PRO`) now
ALSO confers the animated logo (`ANIMATED_MONOGRAM`). The ₱500 standalone stays
on sale for couples who only want the animated logo. No bundle, no price change,
no migration.

- `lib/entitlements.ts` — `ANIMATED_MONOGRAM: ['COUPLE_WEBSITE_PRO']` joins
  `SKU_OWNERSHIP_ALIASES` beside `EDITORIAL_PRO` / `STD_PREMIUM_OPENINGS`. Every
  gate already reads through the alias-aware readers (`eventOwnsSku`,
  `eventSkuActive`, `eventActiveSkus`), so one line reaches: the Monogram
  Maker's ₱500 buy (hidden for a Pro couple), the store grid's Monogram tile
  (reads Active), the Live Studio setup pack card, and every render of the
  animation (public hero, recap, wall, seat pass, seating lab, Save the Date).
  The animation plays once the Pro payment is approved (the handshake holds).
- Monogram Maker — the owned state now reads **"Included with Event Hub Pro"**
  when the animation came with Pro, so the vanished buy button reads as a
  benefit rather than a glitch. A ₱500-only buyer is not told that.
- Checkout has no duplicate-purchase ownership check for any SKU, so nothing to
  extend there; the buy CTA is withheld at the surface.

Tests: `lib/entitlements.test.ts` (Pro owns / non-Pro does not / one-directional
/ handshake / batch fan-out), `lib/animated-monogram.test.ts` (the Included
note). Sabotage: removing the alias turns 5 tests red.

SPEC IMPACT: None — the DECISION_LOG row for the 2026-09-24 ruling exists.
