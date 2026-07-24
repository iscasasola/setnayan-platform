## 2026-07-24 · fix(marketing): repair site-wide footer 404 + harden Real Stories gallery images

Market-introduction polish — two defects on the new-visitor path:

- **Site-wide footer 404.** The global marketing footer's "Real stories" link
  pointed at `/weddings`, which has no route and fell through the `[slug]`
  catch-all to `notFound()` — a 404 on every public page. Repointed to the real
  route `/realstories`.
- **Broken Real Stories gallery images.** Three story cards referenced hero
  image files that don't exist in `public/`, rendering broken `<img>` tags. Added
  an `onError` fallback on the gallery `Tile` so a missing/failed hero image
  falls back to the existing palette-strip placeholder — fixes the three broken
  cards and prevents any future missing image from rendering broken.

SPEC IMPACT: None.
