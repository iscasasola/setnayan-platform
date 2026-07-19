# Changelog fragment — claude/monogram-v1-swatches

## 2026-07-17 · fix(monogram): v1 studio swatches join the circular language (prod-visible)

The owner saw "the palettes returned to oblong" — they were looking at PRODUCTION, which serves the v1 studio until the `monogram_studio_v2` flag flips. The circle fix (#3364) only covered v2; v1 kept its 34×26 backdrop pills, and the app's global 44px touch-target `min-height` stretched even v1's 30px ink/outline circles into vertical ovals.

v1's `markup.ts` now pins every swatch (ink · outline · backdrop · custom) to the same 36×36 circle with the gold selection ring — matching v2 exactly. Transparent checker tightened to read in a circle. This is a deliberate, prod-visible v1 change at the owner's direction.

SPEC IMPACT: None.
