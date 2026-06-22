## 2026-06-22 · feat(recap): the post-event Recap now also aggregates the day's Patiktok reels + the Panood livestream replay

The Auto-Recap "living recap" aggregated the love story, the curated
gallery, the wall-safe day stream, the Kwento voices, the Pakanta backing
track, and the Same-Day Edit film — but two day-of media producers had **no
recap consumer**, so the "recap-aggregates-everything" loop had two holes:

1. **Patiktok reels** (`patiktok_render_jobs.output_object_key`, a rendered
   9:16 MP4 R2 key stamped when a job reaches `status='completed'`) were
   delivered only on the couple's Patiktok studio surface — never surfaced on
   the public recap.
2. **The Panood livestream** (`events.panood_watch_url`) was embedded on the
   day-of page ONLY inside the LIVE window, then dropped in the recap window —
   so the post-event REPLAY had no home.

This PR closes both, mirroring the existing SDE branch (gate → read → presign /
embed → render-when-present, omit-when-absent), and changes nothing about the
free recap when neither feature is owned.

- **`apps/web/lib/auto-recap.ts`** — `assembleRecapModel` gains two best-effort
  reads, each graceful-degrading (42703 / 42P01 / any trouble → omit, never
  throws):
  - `reelUrls: string[]` — queries the event's `patiktok_render_jobs` where
    `status='completed'` AND `output_object_key IS NOT NULL`, newest first,
    capped to 6, and presigns each via `presignDisplayUrl(bucket, key)` (bucket
    from `output_bucket`, defaulting to `setnayan-media`). NOT
    `displayUrlForStoredAsset` — the column stores a BARE R2 key, which that
    helper would mis-read as a legacy passthrough URL.
  - `panoodEmbedUrl: string | null` — when the event holds `PANOOD_SYSTEM`
    (active) AND `events.panood_watch_url` is set, parses the video id
    (`parseYouTubeVideoId`) and builds the privacy-enhanced embed
    (`youTubeEmbedUrl` → youtube-nocookie). This is the post-event REPLAY, so
    showing it in the recap window is correct.
- **`apps/web/app/[slug]/recap/page.tsx`** — two new sections rendered only when
  present, in the media body (after the curated gallery, before the voices),
  styled to match the existing SDE/gallery sections (eyebrows at `text-xs` =
  12px, above the guest-legibility floor):
  - `Reels` — "Reels from the day": a responsive row of `<video controls
    playsInline>` players in 9:16 aspect.
  - `PanoodReplay` — "Watch the livestream": a youtube-nocookie `<iframe>` embed
    in 16:9 aspect.

SPEC IMPACT: 0017 Patiktok / 0011 Panood / 0038 recap — the recap now also
includes the day's reels + the livestream replay, completing the
recap-aggregates-everything loop. No schema change (both producers already
exist); read-only consumers added.
