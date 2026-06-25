## 2026-06-25 · feat(monogram): merge the paid Animated-Monogram upgrade into the maker (Tier 5a)

Owner-confirmed informed reversal of the 2026-06-21 "studio-only maker" decision.

- New `monogram/animated-monogram-upgrade.tsx` — the paid ANIMATED_MONOGRAM
  upgrade as an inline section: OWNED → live confirmation + AnimatedMonogramHero
  preview + Feature-Us opt-in; UNOWNED → before/after preview + InlineCheckoutDrawer
  (live catalog price via `formatV2Sku`, never hardcoded). Owned/unowned bodies
  moved verbatim from the retired standalone page.
- `monogram/page.tsx` renders it below the Vector Studio — one screen: design
  free, then activate the draw-on animation.
- `studio/animated-monogram/page.tsx` retired to a redirect → `/monogram`.

**Fixes a real broken purchase:** the App-Store "Get · ₱X" CTA already routed to
`/monogram`, which had had no buy since 2026-06-21 removed the upsell — the buy
now lives there again, so ANIMATED_MONOGRAM is purchasable. The free static/studio
mark stays ungated; the 2026-06-23 in-studio "Animate the reveal" picker (free
motion-pick) is unaffected — this is the paid activation.

Adversarially verified: flow + buy correct, Get-CTA fix confirmed, real `tsc`
0→0 delta, no regression from the retirement.

SPEC IMPACT: DECISION_LOG.md row added (2026-06-25, the reversal).
