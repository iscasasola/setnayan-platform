## 2026-09-03 · fix(colour-names): the blue/purple boundary CIELAB cannot see

An exhaustive audit of the namer — 2.26 million hexes sampled across six hue
sectors, findings verified by three adversarial judges — measured 16.43%
wrong-family names on a fixed 1,746-hex corpus. After: 8.11% on the identical
corpus file. A 51% reduction. An independent cross-check that uses only RGB
channel ordering and none of the module's thresholds moved the same way,
28.87% → 18.79%.

THE LARGEST GROUP WAS BLUE NAMED AS PURPLE — 91 of 227 — and no threshold
tuning could ever have reached it. Measured: sRGB blue #0000FF and CSS Medium
Purple #9370DB have the IDENTICAL CIELAB hue angle, 306.3° both. The entire
blue→violet arc is 21° in CIELAB and 60° in sRGB, while cyan→blue is 110° in
CIELAB and the same 60° in sRGB. Those failures sat at ΔH* ≈ 0 with Lab Δh as
low as 2°, so tightening MAX_HUE_DRIFT could not see them; sweeping the
existing knobs to drift 10 / labdeg 40 still left 159 failures while doubling
the descriptive fallback.

So a third term was added rather than an existing one tightened:
MAX_SRGB_HUE_DRIFT_DEG = 30, an sRGB hue ceiling beside the existing ΔH*ab ≤ 12
and Lab Δh ≤ 40°. No existing threshold changed. 30° is half an sRGB hue
sextant — the width of one RGB channel-ordering regime — which is the same "one
neighbourhood" idea as the shipped 40°, restated in the space where the blue
arc is not compressed threefold.

Seven curated names added, each verified to clear its nearest existing
neighbour by ΔE: Blackberry, Dusty Plum, Iris, Mint, Nude, Pistachio, Sapphire.

Measured separately so the credit is honest: the guard term alone took 227→153,
the seven names alone took 227→176, both together 227→111. A third lever — a
curated-over-CSS layer-priority margin — was measured at 227→199 and REJECTED
as not worth the behavioural risk.

⚠ SCOPE DISCLOSED: this also adds `srgbHueDeg` to color-space.ts, whose
docblock says "DO NOT ADD A SECOND ONE". It is not a second perceptual space —
it carries no thresholds and nothing can drift out of step with CIELAB; it is
arithmetic on channel ordering, added for the measured reason above. The
docblock now says so explicitly.

Regression anchors re-verified: #8A9A5B→Moss, #9DB2A6→Eucalyptus,
#4A0F1E→Oxblood, #DC143C→Crimson, #20452F→Forest Green, #808080→Gray.

SPEC IMPACT: None — naming accuracy, no stored shape changes.
