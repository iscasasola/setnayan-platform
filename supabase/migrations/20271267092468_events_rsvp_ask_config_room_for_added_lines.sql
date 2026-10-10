-- events rsvp ask config room for added lines
-- Created via `pnpm migration:new`. Idempotent (the constraint is dropped before it is re-added).
--
-- 📏 `events.rsvp_ask_config` GETS ROOM: its size CHECK goes from 2,048 to 24,576 bytes.
-- ONLY the CHECK changes — no new column, no data change, no grant, no RLS, no view.
--
-- ⚖ WHY (spec corpus `Maker_RSVP_Per_Element_Add_Drag_Group_LOCKED_2026-10-09.md` §3–§5; owner, asked "Shall I
-- include that database change in the next batch?": "yes"). The Maker's RSVP stage lets a couple ADD lines to
-- the reply pages (a Heading, a Message), put the lines in their own order and group them under one shared
-- background. Those are kept beside each line's look, in `rsvp_ask_config.look` (apps/web/lib/rsvp-look.ts),
-- and do not fit in 2,048 bytes.
--
-- 🔬 THE NUMBER IS A MEASUREMENT, NOT AN ESTIMATE (2026-10-10; repeated on the replayed schema by
-- apps/web/tests/db/rsvp-ask-config-has-room.db.test.ts, which fails if either number stops holding):
--
--   what the app counts (JSON bytes)  →  what THIS CHECK counts (pg_column_size of the jsonb)
--     17,327  →  19,025   the worst the app's own shape allows: 4 added messages and 4 groups on each of the
--                         3 screens, every line, card and group fully styled, every typed text at its cap in
--                         3-byte characters
--      5,845  →   7,505   the same shape with no typed text — the worst RATIO (×1.284): jsonb spends 4 bytes
--                         on every key and every value, so structure costs more here than it does as JSON
--
--   The app refuses a save above 19,000 JSON bytes with a sentence (`RSVP_CONFIG_ROOM`). For the app's own
--   shape the stored form is at most 1,698 bytes over its JSON (the first row), so nothing the app saves is
--   over 20,700 bytes here — 3,800 bytes under this limit. And even if every one of the 19,000 bytes were
--   structure, 19,000 × 1.29 = 24,510 < 24,576. Whatever the app lets through, this CHECK lets through: a
--   couple is told in words and never meets the database's refusal.
--
-- 🩹 AND IT CURES A FAULT THAT IS LIVE TODAY. The app's old limit (1,900 JSON bytes) never protected the old
-- CHECK (2,048): every line and card fully styled is 1,941 JSON bytes but 2,424 as stored. A look-heavy config
-- between roughly 1,640 and 1,900 JSON bytes passed the app and was refused HERE, at Apply, with the
-- database's own words. The same db test writes that case down as a measurement.
--
-- 🔑 `pg_column_size` IN A CHECK SEES THE VALUE BEFORE IT IS COMPRESSED. Reading the stored column back gives
-- the compressed size (about 1,400 bytes for the 19,025-byte worst case) — a number that would have set this limit
-- thirteen times too low. The test measures by INSERTING under the real constraint, never by reading back.
--
-- ⚠ THE APP'S RAISED LIMIT SHIPS IN THE SAME BATCH AS THIS FILE, NEVER BEFORE IT (deploy-prod applies
-- migrations before the new build is served).
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_rsvp_ask_config_shape;
ALTER TABLE public.events
  ADD CONSTRAINT events_rsvp_ask_config_shape
  CHECK (
    rsvp_ask_config IS NULL
    OR (jsonb_typeof(rsvp_ask_config) = 'object' AND pg_column_size(rsvp_ask_config) <= 24576)
  );

-- ── PROVE IT ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  def TEXT;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.events'::regclass AND c.conname = 'events_rsvp_ask_config_shape';

  IF def IS NULL THEN
    RAISE EXCEPTION 'events_rsvp_ask_config_shape is gone — the column would take any shape and any size';
  END IF;
  IF position('24576' in def) = 0 THEN
    RAISE EXCEPTION 'events_rsvp_ask_config_shape does not carry the measured limit: %', def;
  END IF;
  IF position('object' in def) = 0 THEN
    RAISE EXCEPTION 'events_rsvp_ask_config_shape no longer asks for an object: %', def;
  END IF;

  -- The column itself is untouched: still nullable, still with no default (NULL is "every question still asked").
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events'
       AND column_name = 'rsvp_ask_config' AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'events.rsvp_ask_config must stay nullable with no default';
  END IF;
END $$;
