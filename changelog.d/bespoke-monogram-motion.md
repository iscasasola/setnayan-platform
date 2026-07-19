## 2026-06-22 · feat(std): a BESPOKE monogram now plays the couple's CHOSEN motion on the Save-the-Date (not a generic bloom)

Owner: "we want to be able to play according to the settings created" — the Animated Monogram's chosen motion (draw/foil/bloom/editorial/halo/stardust) must show on a couple's **bespoke custom SVG** mark, not just the lockup. (The lockup already plays them glyph-level via `AnimatedMonogramHero`; a bespoke mark previously got only a generic bloom because the glyph-level library needs real letterforms a custom SVG lacks.)

- **New `BespokeMonogramMotion`** (`app/_components/bespoke-monogram-motion.tsx`): re-expresses each of the 6 signatures as a **whole-mark** effect on the bespoke mark (inert data-URI `<img>`), pure SVG/CSS, SSR-safe, each collapsing under `prefers-reduced-motion`:
  - **draw** — left→right clip-path wipe (drawn-live feel)
  - **foil** — the mark fades in, then a band of gold light **sweeps across it, masked to the mark's own shape** (`mask-image: url(<dataUri>)`) so the foil rides the artwork
  - **bloom** — growing circular clip + blur-to-sharp from the centre
  - **editorial** — rise + settle
  - **halo** — an SVG ring (`pathLength=1` dash sweep) circles the mark, then the mark fades up
  - **stardust** — gold sparkle paths twinkle around the mark as it scale-settles

  All play **once** (no infinite loops). The halo ring + sparks use a normalized `0 0 100 100` viewBox (no px needed). If a browser/SVG can't honor the foil mask, it degrades to a clean fade-in.
- **Wired into `FilmMonogram`**: the bespoke branch now renders `BespokeMonogramMotion` (keyed by `monoReplayKey` so it replays the moment its beat is shown) for Animated-Monogram owners; non-owners keep the static mark. The contrast glow + the lockup branch are unchanged; the now-unused generic `.std-mono-bloom` CSS was removed.

Verified: `tsc --noEmit` exit 0; adversarial review (per-motion CSS correctness + one-shot + reduced-motion + the foil mask; wiring + regressions). The per-motion *look* is owner-verified on-device (the reveal→film→beat sequence + the paid SKU + a real bespoke SVG can't be exercised in the sandbox). Builds on #1989.

SPEC IMPACT: iter 0024 + 0037 — a bespoke/custom-SVG Animated Monogram plays its chosen motion on the STD as a whole-mark effect (the glyph-level library is for lockups/initials). → DECISION_LOG row.
