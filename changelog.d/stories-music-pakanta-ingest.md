## 2026-06-30 · feat(stories): owned-music for free Guest Stories — Pakanta interim + one-command ingest

Free Guest Stories rendered **silent** because `lib/guest-stories.ts` `pickMusic()`
only read the owned `reel_music_tracks` catalogue, which has no ingested masters
(`source_url` NULL). Two changes give the reels sound:

- **Pakanta interim (ships value now):** `buildGuestStoryPlan` now tries the
  couple's delivered Pakanta song (`events.pakanta_song_r2_key`, presigned) FIRST,
  then falls back to the owned catalogue — mirroring the couple-side Patiktok
  render path. Guest reels have a backing track the moment a couple owns a Pakanta
  song, even before the owned catalogue is ingested. `pickMusic` now presigns
  `source_url` via `displayUrlForStoredAsset`, so a catalogue row may store an
  `r2://bucket/key` ref (the ingest convention) or a legacy plain URL.
- **One-command Suno ingest:** new `scripts/ingest-owned-music.mjs` uploads a
  folder of OWNED audio masters to `r2://setnayan-media/reel-music/<slug>.<ext>`,
  computes each track's `beat_grid`, and emits ONE idempotent `reel_music_tracks`
  UPSERT migration (rows + grids). Prod-safe: never writes the prod DB directly
  (rows land via PR → CI → `supabase db push`); `--dry-run` needs no creds.
- **Shared beat module:** extracted `decodeToMonoPcm` / `computeBeatGrid` /
  `loadBytes` into `scripts/lib/beat-grid.mjs` so the ingest and the existing
  `analyze-beat-grids.mjs` can never drift on the algorithm or the stored shape.

Render posture: **Option A (client-side WebCodecs, ₱0) confirmed/locked** as the
V1 render home — the free Stories tier needs no server host. No Option B/host work
(the paid SDE lane that would have needed it is retired).

SPEC IMPACT: Decision-log row appended to `DECISION_LOG.md` (2026-06-30 · Option A
render posture locked + Stories owned-music interim/ingest). No iteration-spec body
edits — `reel_music_tracks` schema unchanged; ingest adds rows, not columns.
