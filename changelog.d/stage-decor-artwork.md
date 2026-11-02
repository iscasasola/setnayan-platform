## 2026-09-06 · feat(moodboard): the stage zone gets generated artwork

Owner ruling 2026-09-06 (Q10): *go on the staged plan, not on ~55 images.*
`build-sessions/RECEPTION-ART-PLAN.md` is that plan; `stage` is its pilot zone —
the couple's own spot, the most-looked-at part of the room. Until now only
`backdrop` and `ceiling` had generated images (MB14b); the other nine zones
render as flat SVG, and eight still do.

Five Recraft V4.1 vectors, one per style family, app-served from
`public/moodboard-seed/venue_scene/stage/`, seeded by `20271211370331` with
**per-file** tolerances measured through the real `recolorRGBA` — 9 · 12 · 15 ·
15 · 15, each the largest integer at which no measured neutral moves. `stage`
joins `PILOT_DECOR_ZONES` and `renderVenueSvg` composites it exactly as it does
backdrop and ceiling, with the couple still drawn in front.

**Yield: 5 keepers / 10 generations (1 per 2.0).** MB28's ceremony scenes were
8 of 68 (1 per 8.5) — reception zones are ~4× cheaper, which is the number this
pilot existed to produce. Extrapolated over the remaining 8 zones × 5 families:
~80 generations, not ~340.

🪤 **Two rules the failures bought, now in the plan:**

- **Tag a draped or flat-clad surface, never ornate furniture.** Every keeper
  tags a tablecloth, runner or clad riser face. Every failure tagged carved
  chairs or a piped sofa, where the model insists on a second tone for frames
  and trim — and a second tone of the *same object* sits at stock colour while
  the rest recolours around it.
- **`colors: [seed, background]` does not pin the dominant region.** On
  `bridgerton · regal` Recraft invented its own dominant (`#8358FB`) and spent
  the passed seed on a *different* object, producing two same-hue regions 12.6
  apart. Three rounds failed that way; passing ONE colour fixed it next attempt.

🔑 **And the measurement itself was missing a check.** The first pass asked only
*"do the neutrals stay put?"* and passed a file whose chairs turned burgundy
while a second purple stayed stock. MB23's attire guard carries `farthestTone`
for exactly this; the decor recipe never inherited it. The fix then flagged the
cream background — 69% of the frame — because it used an HSL *saturation*
threshold, and `#F3ECE0` reads s≈0.44. That trap is documented in prose in
`reception-decor-pilot-prompts.ts` and was walked into anyway.

SPEC IMPACT: None. Extends the existing decor-layer pilot to a third zone.
