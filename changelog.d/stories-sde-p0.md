## 2026-06-28 · feat(stories-sde): P0 — beat-grid schema + offline analyzer + beat-aware template scaffold

Schema + analysis groundwork ONLY for beat-aware Stories/SDE reel rendering.
**Intentionally INERT** — no UI, no render-pipeline dependency, nothing in the
app reads the new column yet. Unblocks P1–P3 later.

- **Migration** `20270307940821_add_beat_grid_to_patiktok_music_tracks.sql` —
  adds a NULLABLE `beat_grid` JSONB column to `patiktok_music_tracks`
  (`ADD COLUMN IF NOT EXISTS`, idempotent). Shape documented in-file +
  `COMMENT ON COLUMN`: `{ bpm, beats:number[] (sec, ascending), downbeats?:number[],
  source, analyzed_at }`. NULL = not yet analyzed → consumers fall back to the
  existing even time-split. Touches NO RLS/policies — the table's existing
  `anyone_reads_active_tracks` + `admin_writes_tracks` guards stay exactly as-is.
- **`scripts/analyze-beat-grids.mjs`** — one-time OFFLINE analyzer. Reads tracks
  from a local manifest or a NON-PROD Supabase, decodes audio (`audio-decode`),
  detects tempo + beats (`music-tempo`), emits a `beat_grid` per track. Prints by
  default; only writes the DB with explicit `--write` and refuses the known prod
  ref. Manual run only (not wired to CI/build). How-to in
  `scripts/README.beat-grids.md`. New `apps/web` devDependencies `music-tempo` +
  `audio-decode` (script-only — `scripts/` is never imported by app code, so the
  web bundle is unaffected; build verified).
- **`apps/web/lib/stories-templates.ts`** — pure data + types beat-aware template
  scaffold. One 30s Stories template + one 30s SDE template, the `BeatGrid` type
  (mirrors the JSONB column), and pure `buildSlotsFromBeatGrid` /
  `evenSplitSlots` helpers that snap photo/clip cut points to beats. Honors the
  locked hard constraints: clips hard-capped at 5s (`CLIP_MAX_SEC`), reels 1–30s,
  9:16. No rendering. Unit tests in `stories-templates.test.ts` (6 pass).

Local verify: typecheck ✓ · lint ✓ (pre-existing warnings only) · prod build ✓ ·
unit tests ✓.

SPEC IMPACT: None for now — additive nullable column + offline script + inert
template module, all behind the as-yet-unbuilt render phase. No SKU, pricing,
flow, or RLS change. P1–P3 (the actual beat-aware render + the Stories surface)
remain gated on the owner's video-render-pipeline decision; when they land,
update `0017_patiktok` / the SDE+Stories spec with the `beat_grid` contract +
the template manifest shape.
