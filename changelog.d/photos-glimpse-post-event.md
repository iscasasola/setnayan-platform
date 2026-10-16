## 2026-10-15 · feat(photos): Glimpse on Post Event's gallery — one style id across stages

Owner 2026-10-15 ("Later, second step" → approved to build). STACKED on `rd/photos-glimpse` (merge AFTER it).

- **One id, two stages**: `glimpse` is now listed in Post Event's Gallery set (`lib/scene-styles-post-event.ts`) as well as
  the Save the Date's (`lib/scene-styles-stages.ts`); the registry merges them into ONE style drawn on `save_the_date` and
  `editorial`. Post Event's gallery pick already lives on the `our_photos` row's `canvas.style`, so the couple's one pick
  carries to the other stage. Free, never a default (Post Event's default stays Grid).
- **Drawn by the SAME rail**: `GalleryPreview` (`editorial/post-event-scene-views.tsx`) gets a `glimpse` branch that mounts
  `GlimpseRail` — no second copy of the drift. The Post Event preview sits inside the open-up's button, so the rail takes a
  new `preview` prop: same drift, same centre emphasis, same pause on touch and hover, but the cards are plain boxes, no
  ‹ ›, no full-screen photo, no "tap to open" line, and the region is not a tab stop; a tap anywhere is the open-up's and
  opens the whole gallery. First 12 photos; bleeds to the screen edges like the film strip.
- Not in this PR: the guest's own "Photos of you" (The Day stage only; Post Event shows them as the gallery's Yours tab,
  inside the opened-up gallery) and the Photo Notes (Kwento) scene (a photo with a note under it — Glimpse has no
  approved note design). Recorded for the owner.
- Guards: `scene-styles-stages.test.ts` (test 4 now pins Glimpse on both stages, one entry, default unchanged),
  `every-scene-style-draws.test.ts` (the preview holds no button/link/tab stop even inside the real `OpenUpScene`; Post
  Event mounts the one `GlimpseRail`), `every-post-event-style-is-drawn.test.ts` (existing — the branch must exist).
  Each sabotaged red, then restored.
- Lab: `/dev/maker-lab/guest?photos=<n>&gstyle=glimpse&pe=1` draws Post Event's gallery preview in the real open-up.

SPEC IMPACT: None — extends the approved Glimpse rows to Post Event as the owner asked ("later, second step").
