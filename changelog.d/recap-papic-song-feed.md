## 2026-06-22 · feat(recap): aggregate the day's Papic photos + the Pakanta song into the editorial

The post-event RECAP / editorial "newspaper front page" previously read manual
couple uploads only and never the couple's real delivered song — closing a
feature-flywheel gap. The editorial now aggregates the day's Papic captures and
plays the delivered Pakanta song. Read-side only; no migration.
(`apps/web/app/[slug]/_components/editorial/data.ts` +
`apps/web/app/[slug]/_components/editorial/editorial-content.tsx`.)

- **Gallery from the day.** `galleryPhotos` now UNIONs the couple's manual
  uploads (`events.our_photos`, kept first) with a recent slice (cap 24) of the
  day's clean Papic captures (`public.papic_photos`), de-duped by URL. A couple
  who shot the day with Papic gets a real gallery with zero manual uploads;
  Papic-empty events collapse to `our_photos` exactly as before.
- **Hero from the day.** When `event_editorial.hero_photo_id` is null (the
  normal case — it has no writer), the editorial hero now AUTO-PICKS a
  representative Papic capture (deterministic: most-tagged clean photo via
  `photo_tags`, tie-broken by recency) instead of only the website hero. The
  website-hero fallback stands when there are no Papic photos. Read-time
  selection; no writer/migration.
- **The 10 moments / essay.** New `essayPhotos` resolves curated
  `event_editorial.essay_photo_ids` when present, else best-effort auto-fills a
  paced spread (cap 10) from the day's captures. Rendered as a new "Moments"
  block (`MomentsEssay`).
- **The song.** New `song` slot reads `events.pakanta_song_r2_key` (column read
  by name, with a column-missing retry on the event select since the writer PR
  may still be merging); when present it presigns and plays the couple's ACTUAL
  delivered Pakanta song in a new "Their Song" block (`TheirSong`, slim audio
  player). Falls back to the typed `love_story.anchors.song` title (credited,
  not playable) when no delivered song.

Every new read graceful-degrades on a missing table/column (42P01 / 42703) →
behaves exactly as today. The five `/realstories` sample fixtures carry the two
new fields (`essayPhotos`, `song`) so the sample tracks the live format.

SPEC IMPACT: 0038 editorial / 0012 Papic / 0036 Pakanta — the recap now
aggregates the day's Papic photos (gallery + hero + moments) and plays the
delivered Pakanta song; closes the Papic→editorial + song→editorial flywheel
gaps. Decision logged at the bottom of `DECISION_LOG.md`.
