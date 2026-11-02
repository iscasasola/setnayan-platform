## 2026-06-25 · feat(marketing): premium-UI pass on /about

- Added a client motion island `apps/web/app/about/_about-motion.tsx` consuming the
  shared foundation primitives (`useReveal` / `useLineReveal` from
  `_premium.tsx`, read-only). `/about/page.tsx` stays a force-static Server
  Component — the island renders the hero so the line-reveal ref sits on the real
  `<h1>` and wraps server-passed children for the section reveals.
- Signature: the hero `<h1>` ("Set na 'yan. Your wedding, all set — on one
  Filipino platform.") gets the serif `useLineReveal({trigger:'mount'})` — the
  page's only type moment, since the heading composes the brand thesis. Eyebrow,
  breadcrumb, and the two lead paragraphs rise after as one quiet `useReveal`
  group. Plays above the fold on load.
- Section reveals: fact grid = one whole-group `useReveal` with a short ~0.05
  stagger across the 4 cards (CSS hover-lift preserved via clearProps:transform);
  "Software, not an agency" block, the FAQ list, and the closing CTA card each get
  a single whole-section reveal (no per-row stagger).
- Gold-budget discipline: demoted the 4 fact-card icons from gold
  (`text-terracotta`) to ink (`text-ink/55`). Zero new gold added; no PanelThread
  on this page.
- a11y: opacity-only motion (no visibility/display), hero `<h1>` text verified
  present in the prerendered static HTML and a11y tree; prefers-reduced-motion
  rests the page fully visible (foundation hooks). Copy, headings, IA, CTA
  labels/links, metadata, and all JSON-LD (AboutPage / BreadcrumbList / FAQPage)
  unchanged — additive only.

SPEC IMPACT: None — additive motion + an on-palette icon colour demotion on one
marketing page; no copy, IA, route, pricing, schema, or product-decision change.
