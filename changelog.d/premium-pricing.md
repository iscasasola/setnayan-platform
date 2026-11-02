## 2026-06-25 · feat(marketing): premium-UI pass on /pricing

The premium-UI motion pass on the `/pricing` trust/transparency surface (the
async Server Component that fetches the 3 V2 catalog tables + emits the
Product/Offer/Service JSON-LD `@graph`). Discipline = RESTRAINT on a page where
honesty is the product: exactly one bold moment, everything else a quiet rise.

- **Signature (the one bold moment):** a single champagne "build thread"
  stitches the three build-status groups of the Software Catalog — Live → In
  build → Coming soon — into ONE continuous vertical line, drawn as the catalog
  scrolls into view. It visualizes "one continuous build heading to Set na 'yan"
  and reinforces the page's honesty thesis. The whole catalog container is
  wrapped in a `usePanelIntro` scope with a single `<PanelThread tone="light"/>`;
  because PanelThread is `preserveAspectRatio="none"` + `height:100%`, that one
  thread STRETCHES to the scope's full height and spans all three groups (not one
  thread per group). Hairline `--m-orange-2`, no fills, hidden < 820px via the
  existing `.sn-thread` rule. The catalog `<h2>` is the panel's
  `data-premium-headline` (serif line-reveal); every group chip + SKU card is a
  `data-premium-item` so they rise in document order as the thread draws past.
- **Quiet reveals (everything else):** the start-free 2-card band, the 4-tier
  ladder (4 cards), the vendor subscriptions, the token packs, and the
  how-money-flows 3 columns each get a short-stagger `useReveal`; section
  headings + the money-flow statement line get the serif `useLineReveal`. The
  hero `<h1>` gets a single `trigger:'mount'` line-reveal on first paint (no
  scroll coupling, no parallax). Exactly ONE PanelThread on the page (catalog
  only) — gold-budget discipline.
- **Server stays server.** `page.tsx` remains `export const dynamic =
  'force-dynamic'` async Server Component: the `fetchV2*` catalog reads, the
  `groupByStatus` grouping, `formatSkuPriceLabel`, the onboarding-only bundle
  rule, the metadata, and the entire JSON-LD `@graph` are UNTOUCHED and still run
  server-side. New `apps/web/app/pricing/_pricing-motion.tsx` is a thin
  `'use client'` island exporting `RevealBand` / `LineRevealHeading` /
  `CatalogPanel` wrappers that render the already-fetched, server-built markup as
  `children` and only attach the reveal/panel refs — no data fetch moves into the
  client.
- **a11y / SSR:** all pricing copy + prices ship in SSR HTML and stay in the
  DOM/a11y tree (reveals are opacity-only, never visibility/display);
  prefers-reduced-motion rests everything visible and draws the thread to its
  final state. The Setnayan-AI tier card keeps its existing 2px terracotta ring
  (no second highlight added); `clearProps:transform` on finish leaves CSS
  hover-lift intact. Only `--m-*` / existing tokens; no new gold fills.
- Touched nothing else: no copy / route / IA / CTA / metadata / JSON-LD /
  business-logic change; no mulberry CTA introduced.
- Verified: `pnpm typecheck` clean; `pnpm lint` no new errors; production
  `pnpm build` compiles `/pricing` clean with the JSON-LD `@graph` intact.

SPEC IMPACT: None — additive front-end motion only; no schema, route, copy, IA,
pricing, or product-behavior change.
