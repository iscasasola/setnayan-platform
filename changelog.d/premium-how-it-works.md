## 2026-06-25 · feat(marketing): premium-UI pass on /how-it-works

- Added a co-located `'use client'` motion island `apps/web/app/how-it-works/_how-it-works-motion.tsx` that consumes the read-only shared premium primitives (`useReveal`, `useLineReveal`, `usePanelIntro`, `PanelThread`) from `@/app/_components/marketing/_premium`. `page.tsx` stays a `force-dynamic` Server Component — metadata, JSON-LD, and hreflang are untouched.
- Signature moment: the champagne `PanelThread` stitch is drawn down the "How everyone connects, in order" flow section (via `usePanelIntro`), tracing the six ordered hand-offs, synced to a serif line-reveal on that section's H2. This is the page's ONLY gold thread.
- Hero: H1 gets `useLineReveal({ trigger: 'mount' })`; eyebrow/lede/CTAs do a quiet `useReveal` opacity+y rise. Kept in a SEPARATE scope from the flow H2 so `usePanelIntro`'s one-headline-per-scope contract holds (hero H1 = `useLineReveal`; flow H2 = `data-premium-headline`).
- Role grid (6 cards): one `useReveal` group, ~0.06 stagger, each card `data-reveal-item`; CSS hover-lift preserved via the hook's `clearProps:transform`.
- "Coming next" V1.2 card: single quiet `useReveal`. Final two-up CTA: paired `useReveal` slight stagger; CTAs/copy/routes untouched.
- Additive only: no copy/route/IA/CTA/metadata/JSON-LD/logic changes. Motion is opacity (+transform) only so all content stays in SSR HTML and the a11y tree; `prefers-reduced-motion` rests everything visible. Exactly one `PanelThread`; no new gold fills; only `--m-*`/existing tokens.

SPEC IMPACT: None — presentation-only motion polish on an existing marketing route; no schema, pricing, SKU, copy, or IA changes.
