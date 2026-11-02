## 2026-09-21 · feat(mood-board): guest colors show as a lineup; every other role is main + accent

Owner, 2026-09-21: "for everybody except the guests, it is main color + accent color."

- `PaletteLimits` gains a required `meaning` (`scene` · `outfit` · `options`). Only `guest` is
  `options`; every attire key is `outfit` and now carries `OUTFIT_SLOT_LABELS`, so the palette
  editor names color 1 "Main" and color 2 "Accent" (the same `slotLabels` mechanism reception
  already used — no schema change).
- "In your colors": an `options` card with 2+ colors draws **one figure per color**, each with a
  named swatch under it ("Any one of these colors"), instead of painting a guest's alternatives
  onto a single dress. Outfit cards are unchanged — still one figure.
- Guarded by `guest-colors-are-options.test.ts` (mounts `BoardCardView`, counts figures against a
  one-figure baseline; sabotage-checked red).

⚠ Known gap, not fixed here: all 75 live `figure_attire` rows carry exactly ONE tagged color range
(`attire`), so an outfit's accent color is shown as a swatch and label but is not yet painted onto
any part of the figure. Painting it needs a second tagged range per figure.

SPEC IMPACT: `DECISION_LOG.md` — attire palette meaning (outfit = main + accent; guests = options).
