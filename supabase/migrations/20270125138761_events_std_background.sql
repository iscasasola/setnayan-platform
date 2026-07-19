-- events_std_background
--
-- Save-the-Date Step-1 "Background" (iteration 0024 · 2026-06-19).
-- The couple's chosen background for their Save-the-Date page, stored as a small
-- JSONB object: { "kind": "plain"|"paper"|"realistic"|"upload", "value": "<...>" }
--   - plain     → value = a hex colour, e.g. "#f3ece1"
--   - paper     → value = a paper style id (ivory-linen · cotton-deckle · …)
--   - realistic → value = a realistic scene id (aurora · golden-hour · …)
--   - upload    → value = the R2 object key of the couple's uploaded photo
-- NULL = not chosen yet → the page falls back to a Mood-Board plain colour.
-- Resolution + validation happens in lib/std-backgrounds.ts (resolveStdBackground).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS std_background JSONB;

COMMENT ON COLUMN public.events.std_background IS
  'STD Step-1 background choice: {kind: plain|paper|realistic|upload, value}. Iteration 0024.';
