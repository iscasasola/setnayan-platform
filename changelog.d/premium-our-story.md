## 2026-06-25 · feat(marketing): premium-UI pass on /our-story

The premium-UI motion pass on the `/our-story` "Living Memories / Alaala" brand
manifesto. Discipline = RESTRAINT: exactly one bold moment, everything else left
as-is.

- **Signature (the only change):** the Act 2 manifesto PIVOT line —
  "A photograph can't hold that. An album can't move. Until now." — now gets a
  serif SplitText line-reveal (lines mask-clip and rise into place as the block
  scrolls into view; the mulberry "Until now." lands last). The line IS the page
  thesis (stillness → motion), so animating it ENACTS the argument.
- Replaced that line's previous `<Reveal delay={140}>` wrapper with the
  line-reveal — NOT nested (nesting would fade-then-rise twice). The Act 2
  opening + middle paragraphs keep their existing `Reveal`.
- New `apps/web/app/our-story/_pivot-line.tsx` — a small `'use client'` island
  wrapping just the pivot `<p>` with `useLineReveal({ trigger: 'view' })` (the
  IO-gated, below-the-fold variant) from the shared `_premium.tsx` foundation, so
  the otherwise-server `OurStory` body stays a server component. The pivot copy
  stays in the SSR HTML + a11y tree (opacity-only, fonts.ready-guarded;
  reduced-motion / SplitText-failure rests fully visible).
- Touched nothing else: Act 1 hero / AlaalaOrb / era cards, Act 3 feature cards
  (+ inline FeatureMock SVGs), Act 4 close, the "What Setnayan is" SEO section,
  and the footer are all untouched. Zero new gold (no PanelThread on this page —
  the orb halo + gold era card already spend the gold budget); the signature is
  type-motion, not color. Only `--m-*` tokens; no copy/route/IA/CTA/metadata/
  JSON-LD change.
- Verified: `pnpm typecheck` clean; `pnpm lint` no new errors (warnings are all
  pre-existing in unrelated files); production `pnpm build` compiles `/our-story`
  clean (the RSC server→client-island boundary is prod-valid).

SPEC IMPACT: None — additive front-end motion only; no schema, route, copy, IA,
pricing, or product-behavior change.
