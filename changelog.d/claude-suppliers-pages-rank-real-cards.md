## 2026-09-27 · feat(seo): /suppliers landing pages, built from suppliers' own service cards

The SEO & AI Discoverability Playbook (locked 2026-05-14, spec doc 17 §5.1)
planned `/suppliers/[category]/[city]` pages and nobody built them. People
search "debut package Quezon City", "wedding coordinator rates" and "wedding
venue Tagaytay", and we had no page that could answer. Built now, with an
EVENT level the owner added:

- `/suppliers` · `/suppliers/[event]/[category]` · `/suppliers/[event]/[category]/[city]`
  (e.g. `/suppliers/debut/coordinator/quezon-city`).
- Built from `vendor_services` cards on LIVE (`isShopLive`) non-demo shops. The
  card is THE service card (`ServiceCardView`), drawn by a new shared helper,
  `lib/service-card-faces.ts`, which lifts /explore's pipeline verbatim.
- Every figure is read from the cards. Each pricing basis (package / per guest /
  per hour) is summarised on its own; they are never one mixed range. A shop that
  hides prices contributes none.
- **The gate:** a page is `index` only at ≥3 cards from ≥2 shops
  (`SUPPLIER_PAGE_MIN_*` in `lib/supplier-landing.ts`). Below that it still
  renders for people, but is `noindex` and left out of the new
  `/sitemap-suppliers.xml`. The sitemap and the pages use one function, so they
  cannot disagree.
- JSON-LD: BreadcrumbList · ItemList of Services with their Offers ·
  AggregateOffer (package prices) · FAQPage. The FAQ's commission answer is
  `COUPLE_COMMISSION_PROMISE`.
- Registries: `suppliers` reserved in `business_slug_is_reserved` (migration
  `20271248809664`, body read live from production; no shop or event held the
  word), the generated `ROUTE_RESERVED_SLUGS`, `KNOWN_PUBLIC_ROUTES`, the sitemap
  index, and `sw.js` for `sitemap-suppliers.xml`.

Measured at build: production has 2 service cards, both on a sample shop, so
every page starts dark and switches itself on as suppliers publish.

Known gaps, named rather than hidden:
- The pages carry a data summary, the cards and 3 FAQs, which is below the
  playbook's 400/600/800-word minimums. Per-category guide copy is the follow-up.
- /explore still carries its own inline copy of the card pipeline. Five guards
  read it by path, so moving it onto the shared helper is its own PR.
- The service worker does not reserve any `(shell)`-group page, including
  `/suppliers`. This gap already affects /budget, /pricing and the rest; it is
  filed as its own task.

SPEC IMPACT: `02_Specifications/17_SEO_and_AI_Discoverability_Playbook.md` §5.1
gets a 2026-09-27 note (event level, gate, content-depth gap), with the .docx
regenerated. `DECISION_LOG.md` gets a 2026-09-27 row. Both are committed in the
corpus.
