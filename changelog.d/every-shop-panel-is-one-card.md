## 2026-08-24 · change(vendor): every supplier panel is one card

W4-B, PR 3. The card-recipe half of the convergence is finished: the 19
remaining solid section-card sites across 9 files (the customer card's six
inline panels, challenge photos, script tab, 3D-plan unlock, challenge
section, all five Demand Radar panels, invite, payday, theft watch) render
through the kit. Panels became `<ShopCard>` (pad variants mapped from their
shipped spellings); the two LIST-ITEM cards (`<li>` in theft watch,
`<article>` in payday) keep their element and compose the new exported
`shopCardClass` constant, which `ShopCard` itself consumes — so the recipe
still exists exactly once and the guard's pin holds.

The guard also got sharper: `bg-white/60` and `bg-white/70` are the tree's
deliberate translucent glass variant, and the substring count was claiming
them as hand-rolled solid cards — the card pattern now carries a lookahead,
so the 10 glass panels are recognised as a different surface and left alone.

`kit-convergence.baseline.json` is now EMPTY: zero hand-rolled copies of
either recipe anywhere in the supplier tree; any new one fails the guard.
Typecheck ✅ · reads-are-honest ✅ · rail/nav guards ✅ ·
lint-port-no-lost-controls ✅ (404 routes, nothing lost).

SPEC IMPACT: None.
