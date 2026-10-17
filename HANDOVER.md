# HANDOVER — rd/the-veil-stays-with-the-cover (2026-10-17)

Owner ruling 17 Oct: "the veil disappears. it shouldn't. it should stay until cover is gone. and return when cover scene returns".

## Done
- `lib/reveal-stages.ts`: `COVER_SCENE_SELECTOR`, `coverOnScreen`, `drapeShift`, `drapeShows` (the rule).
- `reveal-overlay.tsx`: off the Save the Date, from the unveil gesture on (`unveiled = lifting || open`), the overlay is never
  retired (the 1.8 s retire after `std-reveal-done` is gone); one IntersectionObserver on `header[data-cover-scene]` (+ scroll
  for the ride) hides the layer and pauses the cloth when the cover is off screen, and translates the layer with the cover's
  top edge. `data-reveal-up` comes off at the unveil (scrub hand-overs arm). Pre-unveil scroll-past still retires it.
- `veil-reveal.tsx`: `keepsOpen` (hit-zone inert after unveil, swipe-down never re-covers), `paused` (loop stops / wakes),
  still drape under Save-Data / reduced motion (loop ends on its last frame after settling).
- Guard: `app/[slug]/_components/reveal/the-veil-stays-with-the-cover.test.ts`; superseded assertion updated in
  `lib/the-couple-picks-where-the-reveal-plays.test.ts`.

## Decisions taken (controller's reading, logged in the PR body)
- "Cover gone" = the bars' edge (cover bottom past the top of the screen) so drape and bars are never up together.
- Reduced-motion guests still get no veil at all (existing rule); "still" applies to Save-Data and mid-visit reduced motion.
- Page with no Cover Scene header: the first screen is the cover. A hidden cover (another tab) = gone.

## Next
- targeted tests (heavy lock queue was long) · sabotage · walk 375 WebKit + 1280 · draft PR · CI.
