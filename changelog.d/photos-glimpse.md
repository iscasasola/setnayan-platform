## 2026-10-15 · feat(photos): Glimpse — a 4th Photos style that drifts; the Photos scene's own heading

Owner 2026-10-15 (DECISION_LOG "GLIMPSE PHOTO STYLE APPROVED; THE PHOTOS SCENE GETS A TYPED HEADING" and "GLIMPSE'S
MOTION IS A SLOW CONTINUOUS DRIFT, NOT A STEP"; prototype `photos_glimpse_style_2026-10-15_fable.html`).

- **Glimpse** (`glimpse`, Save the Date only, free): one 3:4 photo centred, its neighbours peeking in at .92 / .72,
  measured every frame from each card's distance to the middle. A slow continuous sideways drift (about one photo
  every 9 s), an endless loop with no snap-back (the photos are drawn three times once the page is live, and the rail
  moves back by exactly one copy). Snap is off while it drifts and on while the guest browses by hand; touch, swipe,
  wheel, hover and keys pause it, and it resumes 6 s after; it holds while the full-screen photo is open, off screen,
  in a hidden tab, and under reduced motion (no drift, no scale). The centre photo opens the shipped
  `GalleryLightbox` (‹ › and "3 / 12" in its actions); a neighbour tap brings it to the middle. Dots up to 8 photos,
  then a "3 / 12" counter. Desktop: ‹ › on hover and ← → keys. The server draws a plain snap rail, every photo once.
  `app/[slug]/_components/glimpse-rail.tsx` (client leaf) · `OurPhotosGlimpse` in `our-photos-styles.tsx` · the
  widget branch · a Maker sample shape · `lib/scene-styles-stages.ts`.
- **The Photos heading**: `config_json.photos_heading` on the `our_photos` row (`lib/photos-heading.ts`) — no
  migration. Drafted like `std_lead` (`HubDraftWidget.photos_heading`), one free change at ✓ Apply with its own
  change line. Every Photos style draws it as an `<h2>` under the kept "Our photos" line; with none typed the scene
  is byte-identical to today. Typed in **Studio › Info** ("Photos heading", a Form row through the one draft door);
  the Gallery part's Edit door is "Open in Studio › Info" and lands on that row. The launch page reads the Photos
  row in the same request as the hero row (no new request).
- Guards: `scene-styles-stages.test.ts`, `layouts-are-the-shipped-scene-styles.test.ts`,
  `every-scene-style-draws.test.ts` (1 · 2 · 5 · 12 photos), `the-typing-door-is-the-info-door.test.ts`,
  `the-apply-sheet-names-each-change.test.ts`, new `lib/photos-heading.test.ts`.
- Lab: `/dev/maker-lab/guest?photos=<n>&gstyle=<style>&heading=<words>` draws the real scene with stand-in pictures.

SPEC IMPACT: None — builds the approved prototype and the 2026-10-15 DECISION_LOG rows as written. Builder's choices,
recorded for the owner: the heading sits UNDER the kept "Our photos" line (the prototype draws both); it is typed in
Studio › Info, not yet on the page itself; Post Event's Photos of you does not get Glimpse yet ("later, second step").
