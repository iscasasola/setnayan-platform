## 2026-10-18 · feat(logo): L5 — Ornament, the fourth Add-layer kind

Owner 2026-10-08, DECISION_LOG "LOGO MAKER REPLOT APPROVED, WITH ORNAMENT" (verbatim *"approve add ornament"*,
reversing the 2026-10-06 removal). ＋ Add layer is now Text · Image · Frame · **Ornament** ("A flourish, a leaf, a
star", the prototype's words). An ornament is a closed set of six vector shapes — Flourish · Blossom · Leaf · Star ·
Fleur-de-lis · Diamonds, the prototype's `❦ ✿ ❧ ✦ ⚜ ❖` — drawn as plain filled paths (`lib/logo-ornaments.ts`), so it
recolours like a frame, is sized/moved/rotated by the same sliders and pinch/twist, hides/locks/duplicates/deletes like
any layer, and Draws on / Rises / Fades through Animate. Style › **Ornament ▾** swaps one for another.

Which ornament a layer is lives in its shapes (`data-ornament` on the body's group), not in the config, so the
first-load `logo-layers.ts` grows by the kind name only and the six shapes ride in the lazy Logo editor chunk.

Guards: new `lib/the-logo-adds-ornaments.test.ts` (5 tests, sabotaged 7 ways, each red); re-aimed with dated notes
`the-logo-adds-three-things-only` (Ornament allowed; starting designs and download still banned), `the-logo-is-layers`
(Add list of four), `studio-logo-are-the-templates` (five dropdowns).

SPEC IMPACT: None — builds the approved 2026-10-08 replot's L5 as recorded.
