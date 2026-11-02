## 2026-10-25 · feat(papic): the Filter tiles show our sample photo, developed through each look

Owner, 25 Oct: *"the filters should have a sample photo. which should be our photo. we already have a
photo already used for this before"*. The five Filter tiles (Original · Retro · Mono · Cine · Lomo,
`style-picker.tsx`, both the strip and the cards) were coloured gradients run through `cssPreview`.

- **The photo** is the frame the owner supplied for exactly this on 2026-09-23 (*"papic look should
  have an actual photo for sample with a lot of colors"*), committed then as
  `public/papic/look-sample.webp` in `644592545e` on `claude/papic-drops-the-back-link` — a branch that
  never merged, so main kept the gradient. Restored as the source `apps/web/assets/papic/look-sample.source.webp`.
- **The exact look, not the CSS guess.** `pnpm render:papic-looks` runs the camera's own
  `applyPapicStylePixels` over the square around the two faces (upscaled to the camera's 1440 px so
  grain / sharpening / aberration sit at real scale), stored at 240 px WebP, ~10 KB each, in
  `public/papic/looks/<STYLE>.webp`. Tiles are lazy `<img>`s with the look's name as alt; ring, check,
  labels and the one-tap save are unchanged.
- **Guard** `lib/papic-look-samples.test.ts`: every look has its picture on disk (a real WebP, small),
  every tile of both variants draws exactly one picture, no gradient / `cssPreviewFilter` swatch is
  left, and the pictures are current — a hash of the pixel half of `papic-photo-styles.ts` + the photo;
  change the maths without re-rendering and it goes red naming the command.

SPEC IMPACT: None
