## 2026-07-17 · feat(stories): place/service/kind search across editorials + chapters (volume-gated)

Added faceted search to the `/realstories` stories hub spanning BOTH shelves —
the Setnayan editorial cascade AND the "From Our Storytellers" featured-chapter
shelf — per the Creator Economy build plan's **P4+ "Stories SEARCH"** section
(`Creator_Economy_Discount_Collab_Build_Plan_2026-07-16.md`, council INTEGRATE
verdict, owner-confirmed "search spans the WHOLE library").

Three facet axes, each a union across both pools:
- **Milestone (kind)** — editorial event type (Wedding) + chapter kind label
  (Wedding · Travel · Food · Lifestyle).
- **Place** — the event `city` (edition venue for editorials; the chapter's
  linked event venue, same `deriveCity` derivation).
- **Service** — the credited vendors' canonical service categories (editorial
  credits via `event_vendors → vendor_profiles.services`; chapter substrate
  `vendor_ids → vendor_profiles.services`, publicly-visible vendors only).

Results keep their voice — editorial → Chronicle `Tile`, chapter →
`StorytellerTile` — rendered in two labelled sections; same-event cross-rail
chips ride along unchanged.

**Display gate:** the search UI mounts only when the already-public
featured+curated pool (editorials on the page + featured chapters) is ≥
`STORIES_SEARCH_MIN_POOL` (= 50, named tunable in server-safe
`lib/stories-search-config.ts`). Below the gate the hub keeps its exact shelf
layout (editorial cascade + Storytellers shelf). Today the pool is a handful of
items ⇒ gate closed ⇒ the render is unchanged and the extra facet queries never
run.

Read-only over the already-public pool (reuses `loadPublishedShowcases` +
`loadFeaturedChapters`); NO new schema, NO new tables. New: `StoriesSearch`
client component, `loadChapterSearchMeta` (chapter city + category enrichment),
`serviceCategories` on `ShowcaseEntry`, exported `Tile` + `deriveCity`.

Files: `app/realstories/page.tsx`, `app/realstories/_components/stories-search.tsx`,
`app/realstories/_components/gallery.tsx`, `lib/showcase-db.ts`,
`lib/storytellers.ts`, `lib/stories-search-config.ts`.

SPEC IMPACT: None for schema (query + UI only). Records delivery of the P4+
Stories SEARCH plan (place/service facets on the hub, volume-gated ≥ ~50);
DECISION_LOG.md row added in the corpus.
