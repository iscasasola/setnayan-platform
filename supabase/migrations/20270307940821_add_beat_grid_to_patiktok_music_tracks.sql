-- Stories+SDE P0 — beat grid on the Patiktok music catalogue
-- ============================================================================
-- Adds a NULLABLE `beat_grid` JSONB column to `public.patiktok_music_tracks`.
-- This is the schema groundwork for beat-aware reel rendering (Stories + SDE).
-- It is INERT until later phases: nothing reads it yet. The client render
-- engine (apps/web/lib/patiktok-render.ts) still does an even time-split today;
-- a future phase will snap photo/clip cut points to these beats.
--
-- The table already exists with its RLS enabled + two policies
-- (`anyone_reads_active_tracks` SELECT, `admin_writes_tracks` ALL). This
-- migration ONLY adds a column — it does NOT touch RLS or any policy, so the
-- existing read/write guards stay exactly as-is. ADD COLUMN IF NOT EXISTS keeps
-- it idempotent (re-applies cleanly).
--
-- ----------------------------------------------------------------------------
-- beat_grid SHAPE (JSONB) — populated offline by scripts/analyze-beat-grids.mjs
-- ----------------------------------------------------------------------------
-- An object describing the track's rhythmic grid in SECONDS from t=0:
--
--   {
--     "bpm": 108,                 -- detected tempo (number, beats per minute)
--     "beats": [0.55, 1.10, ...], -- ascending beat onset timestamps, seconds
--     "downbeats": [0.55, 2.77],  -- OPTIONAL: bar-start beats (subset of beats)
--     "source": "music-tempo",    -- analyzer that produced it (provenance)
--     "analyzed_at": "2026-06-28T00:00:00Z"
--   }
--
--   • `bpm` + `beats` are required when the column is non-null.
--   • `downbeats` is optional (omitted when the analyzer can't infer bars).
--   • NULL = not yet analyzed → consumers fall back to the even time-split.
-- A future migration MAY add a CHECK once the shape is load-bearing; left open
-- now so the offline analyzer can iterate on the schema without a DB round-trip.

ALTER TABLE public.patiktok_music_tracks
  ADD COLUMN IF NOT EXISTS beat_grid JSONB;

COMMENT ON COLUMN public.patiktok_music_tracks.beat_grid IS
  'Stories+SDE P0 — beat-aware render groundwork. JSONB { bpm:int, beats:number[] (seconds, ascending), downbeats?:number[], source:text, analyzed_at:timestamptz }. NULL = not yet analyzed (consumers fall back to even time-split). Populated offline by scripts/analyze-beat-grids.mjs; inert until later Stories/SDE render phases read it.';
