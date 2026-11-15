## 2026-11-14 · feat(ui): ScratchCard — a reusable scratch-off

A shared `<ScratchCard>` (`app/_components/scratch-card.tsx`): any content underneath, a champagne-gold cover (or a cover image) on a canvas over it. Finger or mouse rubs the cover away in smooth strokes; past 55% (configurable) the rest fades out over 400ms and `onComplete` fires once. Retina-sized, resizes with its box without re-covering what was scratched, a sheen on what is left of the cover and gold dust under the finger. Reduced motion: one tap reveals, no sheen, no dust. Enter/Space reveals from the keyboard. A cross-origin cover image cannot be read back, so progress then falls back to an estimate from the strokes instead of never finishing.

The rules for when it is done are pure (`lib/scratch-card.ts`) with their own tests. Built for the couple's "a supplier's gift landed" unwrap moment; **not wired into any screen yet**.

SPEC IMPACT: None

**Mounted (2026-11-15).** `<ScratchCard>` now mounts from a dev-only lab, `/dev/scratch-card-lab` (`page.lab.tsx`; production 404s it). It shows the gold cover, the controlled `revealed` and `disabled` on sample content, so the canvas can be tried on a real phone. This clears `ugat-both-ends` ("component-no-mount") without adding to that baseline. The lab takes one reasoned line in `lib/ugat/baselines/no-door.baseline.txt`, like every other `/dev/*-lab`.
