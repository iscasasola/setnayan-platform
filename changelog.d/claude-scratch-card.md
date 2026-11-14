## 2026-11-14 · feat(ui): ScratchCard — a reusable scratch-off

A shared `<ScratchCard>` (`app/_components/scratch-card.tsx`): any content underneath, a champagne-gold cover (or a cover image) on a canvas over it. Finger or mouse rubs the cover away in smooth strokes; past 55% (configurable) the rest fades out over 400ms and `onComplete` fires once. Retina-sized, resizes with its box without re-covering what was scratched, a sheen on what is left of the cover and gold dust under the finger. Reduced motion: one tap reveals, no sheen, no dust. Enter/Space reveals from the keyboard. A cross-origin cover image cannot be read back, so progress then falls back to an estimate from the strokes instead of never finishing.

The rules for when it is done are pure (`lib/scratch-card.ts`) with their own tests. Built for the couple's "a supplier's gift landed" unwrap moment; **not wired into any screen yet**.

SPEC IMPACT: None
