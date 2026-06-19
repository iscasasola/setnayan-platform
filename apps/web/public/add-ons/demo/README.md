# Studio app-card demo media

Looping `<slug>.mp4` + `<slug>.jpg` poster for each Studio feature's on-card
demo. When a slug is registered in `RICH_MEDIA` (see
`app/_components/app-store/studio-card-demo.tsx`), its app card PREFERS this
looping video; otherwise it falls back to the live animated React scenes.

**These are not hand-made.** They are recordings of the **same** `RICH_SCENES`
the live card renders (the four scenes, captions baked in), so the video can
never drift from the live demo. They double as shareable clips (FB/IG).

- **Format:** 9:19 vertical, H.264, 24fps, 460×972, ~12s phase-aligned loop,
  ~40–70 KB each. Poster is scene 0 as JPEG, ~18–34 KB.
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
