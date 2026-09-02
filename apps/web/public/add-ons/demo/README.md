# Studio app-card demo media

Looping `<slug>.mp4` + `<slug>.jpg` poster for each Studio feature's on-card
demo. When a slug is registered in `RICH_MEDIA` (see
`app/_components/app-store/studio-card-demo.tsx`), its app card PREFERS this
looping video; otherwise it falls back to the live animated React scenes.

**These are not hand-made.** They are recordings of the **same** `RICH_SCENES`
the live card renders (the four scenes, captions baked in), so the video can
never drift from the live demo. They double as shareable clips (FB/IG).

- **Format:** 9:19 vertical, H.264, 24fps, 460×972, ~12s phase-aligned loop,
  **~54–114 KB each** (avg ~80). Poster is scene 0 as JPEG, ~17–33 KB.

  ⚠ **The old figure here was ~40–70 KB, and it was small because the clips were
  BROKEN.** Until 2026-09-03 the recorder composited a 230×486 page into a
  460×972 canvas and padded the rest flat grey — three quarters of every frame
  was a solid fill, which is nearly free to encode. A full frame of real UI at
  true 2× costs more, and that is the correct price. If this range ever drops
  back toward 40–70 KB, suspect the geometry before congratulating anyone:
  `scripts/lint-demo-capture-geometry.mjs` guards the cause.
- **Swap in place:** keep the filename and the card updates with no code change.

## Regenerate

From `apps/web`, with the dev server running (`pnpm dev` on :3000) and a
libx264 ffmpeg available:

```bash
# one-time: a real ffmpeg (Playwright's bundled one is VP8-only)
#   FFMPEG_BIN=$(node -e "console.log(require('ffmpeg-static'))")   # if installed
FFMPEG_BIN=/path/to/ffmpeg pnpm capture:demos            # all 14
FFMPEG_BIN=/path/to/ffmpeg pnpm capture:demos papic      # one slug
```

The recorder drives the internal `/demo-capture/[slug]` route (dev/CI-only;
404s in prod unless `ALLOW_DEMO_CAPTURE=1`). See
`scripts/capture-demo-videos.mjs`.
