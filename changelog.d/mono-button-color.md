## 2026-06-22 · fix(std): STD logo uses the BUTTON (accent) colour + is ~50% larger

Owner: "the logo colour will be same as button colour. do not follow the colour from monogram. we will bypass it for this" + "can we make the logos larger … around 50% larger?"

**Colour — the logo ink is now the couple's accent (the CTA-button fill), not the monogram's own colour.**
- `HeroMonogram` gained an optional `inkOverride?: string` that forces the mark ink, overriding BOTH the design's curated ink (`resolveMonogramDesign(event).color` — the mulberry/gold enum) AND `monogram.color`. Previously the STD passed `{...monogram, color: accent}`, but `HeroMonogram` re-resolves ink from the design columns — so that override was **dead** for any couple with a real bar/duo/script/infinity/framed lockup (the common case). Now `ink`/`markColor` both honour `inkOverride` across every branch (lockup geometry, animated, framed, legacy-circle border). The ∞ gold gradient stays independent.
- The STD film (`FilmMonogram`) passes `inkOverride={accentHex}` (= the same hex the calendar button uses, `stdAccentColor(event)`); the `tone`-based `contrastInk` recolour is removed (the accent + the visibility glow replace it). The **marketing hero omits `inkOverride`, so it is unchanged.**
- Caveat (inherent): a baked **uploaded/lab SVG** mark can't be re-inked, so "logo = button colour" applies to the typographic lockup; a custom SVG keeps its own colours (only its halo-motion ring takes the accent).

**Size — every STD logo beat is ~1.5× larger:** opening `scale-[1.8]→[2.7]` / `h-36→h-[13.5rem]`; sentiment `scale-[0.9]→[1.35]` / `h-16→h-24`; close `scale-[1.1]→[1.65]` / `h-24→h-36`.

Verified: `tsc --noEmit` 0. The first review caught the dead override (blocker); fixed by routing through `inkOverride`, then re-reviewed (ink reaches every lockup branch · hero non-regression · size overflow). ESLint/iOS via CI; on-device look owner-verified. Builds on #1989/#1991.

SPEC IMPACT: iter 0024 + 0037 — the STD logo renders in the couple's accent (button) colour via `HeroMonogram.inkOverride`, ~50% larger (the tone-based contrast recolour is superseded; the glow stays). → DECISION_LOG row.
