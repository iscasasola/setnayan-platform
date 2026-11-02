## 2026-06-28 · fix(onboarding): close the dead band on the desktop region step

Follow-up to the desktop onboarding layout pass. On the region step
(`/onboarding/wedding` → "Where will it be?"), the tapzone stretched (`flex:1 1 auto`)
and its `.locresults-wrap` bottom-docked the destination carousel
(`justify-content:flex-end` — the right behaviour above the mobile thumb zone). On the
wide desktop canvas that left a conspicuous dead band between the heading and the cards.

Fix (`onboarding-desktop.css`, desktop-only): stop the region tapzone stretching
(`flex:0 0 auto`) and top-anchor the results wrap so the heading → selected-area chip →
"Top 30 destinations" carousel → search row read as one compact group; the screen-level
`justify-content:center` then balances it on the canvas.

Scope: `#screen-region` only, inside `@media (min-width:1024px)`. Mobile/tablet keeps
the bottom-docked carousel. Verified live — the band is gone and all controls fit above
Continue.

SPEC IMPACT: None (desktop-only CSS polish; no schema, copy, pricing, or flow change).
