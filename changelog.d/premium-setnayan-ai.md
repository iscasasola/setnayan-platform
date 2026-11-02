### Premium-UI motion pass on /setnayan-ai

Adopted the premium-UI motion standard (`Premium_UI_Standard_2026-06-25.md`) on the
`/setnayan-ai` marketing landing page, mirroring the `/about` and `/our-story` passes.

- **New client island** `apps/web/app/setnayan-ai/_setnayan-ai-motion.tsx` ('use client')
  consuming the read-only shared primitives in `_components/marketing/_premium.tsx`
  (never edited). `page.tsx` stays a force-static Server Component — `metadata` and
  both `<script type="application/ld+json">` blocks (SoftwareApplication + FAQPage)
  remain in the server file.
- **Signature (the one spectacle):** the hero `<h1>` "Say it once. Find your perfect
  fit." self-composes once via the serif line-reveal (`useLineReveal trigger:'mount'`,
  fires above the fold after `document.fonts.ready`, not IO-gated, not scrubbed); the
  eyebrow / subcopy / CTAs settle in one quiet beat after (`useReveal` group). No second
  competing moment below.
- **Below-fold motion (all quiet):** How-it-works = `usePanelIntro` with the page's ONE
  `PanelThread` (champagne stitch) + staggered card rise, 01/02/03 numerals and hover-lift
  preserved · Matchmaking = thread-less `usePanelIntro` headline line-reveal + staggered
  row-rise only (no morph/collapse — the static struck-through → affirmed contrast carries
  it) · FAQ = one incidental `useReveal` whole-block fade, no per-row stagger · CTA card =
  thread-less `usePanelIntro` headline line-reveal + button rise; gold stays a hairline
  `--m-orange/40` border on cream, no fill/glow.
- **Token migration (value-equivalent only):** swapped exact-match hardcoded hexes to
  `--m-*` tokens — `#1E2229`→`--m-ink`, `#5C2542`→`--m-mulberry`, `#FBFBFA`→`--m-paper`,
  `#C5A059`→`--m-orange`. The mulberry CTAs and the orange-border cream CTA card read
  identically after. Four tour-palette hexes with no value-equivalent token
  (`#8C6932` eyebrow, `#5F5E5A` body, `#9A8F86` struck text, `#FBF6EA` CTA card fill) were
  left unchanged — swapping them would alter the rendered color.

a11y / SSR: all text ships in SSR HTML and stays in the DOM/a11y tree; motion is
opacity/transform only (never visibility/display); `prefers-reduced-motion` rests
everything visible; the heading-level outline is byte-identical to before.

**SPEC IMPACT:** None — additive motion + value-equivalent token swaps only. No copy,
route, IA, CTA, metadata, or JSON-LD change.
