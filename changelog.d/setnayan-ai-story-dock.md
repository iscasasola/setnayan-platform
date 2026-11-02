## 2026-07-03 · feat(marketing): dock → 5 flagship products + one-page Setnayan AI story takeover

Owner 2026-07-03: the homepage's five bottom tiles are reassigned to the flagship PRODUCTS —
**Ala ala (Memory Hub) · Suri (Setnayan AI) · Papic · Panood (Live Studio) · 3D Plan** — and the
Suri tile opens a **one-page, no-scroll (desktop) Setnayan AI story** INSIDE the new homepage,
fixing the owner-reported bounce to the old-chrome `/setnayan-ai` route.

- `pillars.tsx` — `PILLAR_HEROES` reassigned to the five products (new head/desc per tile; slot
  gradients + ids retained). New `sectionId` per tile + `PILLAR_SECTION_IDS`: a tile's
  "Learn more" jumps to its MATCHING below-fold section (Ala ala → Ala Ala suite, Suri → the
  Suri suite); queued products (Papic/Panood/3D Plan — stories to come) fall back to the top of
  the content instead of scrolling to mismatched sections.
- `setnayan-ai-story.tsx` (new) — the fullscreen story takeover: GTM copy ("It doesn't chat. It
  watches your event for you."), the three shipped jobs, the restraint promise, catalog-driven
  price (₱799/28d · ₱499 first), CTAs. One 100dvh screen, no scroll at desktop heights (short/
  mobile viewports scroll); Esc/backdrop/✕ close via useModalA11y; portaled like OverlayShell.
- `HomeReskin.tsx` — story state; selecting the Suri tile paints its scene AND opens the story;
  `onOpenStory` threaded to `HomeOverlays` so the nav pop-up's "See the full story →" opens the
  in-world story instead of navigating to the old-chrome route (fallback Link preserved).

Flagged (not built here): the other four product stories are QUEUED (owner); the below-fold
sections still render the original five pillar suites; /admin/background-videos slot labels are
positional and may want a refresh; the broader old-marketing-chrome retirement is a separate
program the owner has called for.

SPEC IMPACT: homepage dock = 5 flagship products (owner 2026-07-03); logged in DECISION_LOG.
