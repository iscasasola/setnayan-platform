-- WIDEN event_inspiration_assets.slot_key TO 16 SLOTS — add backdrop,
-- flowers, cocktail.
--
-- The Mood Board redesign (2026-09-02) closed 3 real gaps the owner flagged
-- directly against the live 13-slot inspiration board
-- (apps/web/app/dashboard/[eventId]/wizard-actions.ts MOODBOARD_SLOT_KEYS,
-- apps/web/app/dashboard/[eventId]/studio/mood-board/_components/
-- inspiration-board.tsx GROUPS):
--   • 'backdrop' — reception_design already has a `backdrop` zone
--     (apps/web/lib/reception-scene.ts) but no matching inspiration slot
--     existed for a couple to upload a reference photo against it.
--   • 'flowers' — no flowers slot existed at all, despite florals being a
--     named RolePalette-adjacent concern throughout the mood board.
--   • 'cocktail' — no cocktail-hour slot existed; common as its own reception
--     segment, especially for Filipino weddings.
--   • 'reception_venue' — ⚠ THE ASYMMETRY THAT MADE THE LIST READ WRONG. The
--     original 13 carried exactly ONE venue slot, `venue`, which the UI labels
--     "Ceremony venue" — while SIX of its siblings (backdrop · ceiling · stage
--     · table · tunnel · cocktail) are reception elements. A couple could
--     upload the church but NOT the ballroom or garden they actually booked.
--     ⚠ `venue` IS DELIBERATELY NOT RENAMED to `ceremony_venue`: real couples
--     have rows under slot_key='venue' from onboarding Card 15 since
--     20260627000000, and a rename would orphan every one of them. The key
--     stays `venue`; only its LABEL says "Ceremony venue", and the reception
--     half arrives as a new key beside it.
--
-- ⚠ THREE GATES, NOT ONE — all three are edited together in this same change,
-- because a slot added to only some of them fails in a way that looks like
-- nothing: (1) MOODBOARD_SLOT_KEYS in wizard-actions.ts, whose
-- isMoodboardSlotKey() rejects an unlisted key with "slot_key invalid" BEFORE
-- any DB call; (2) the GROUPS list in inspiration-board.tsx, which is the only
-- thing that renders a tile at all; (3) this CHECK. Miss (1) and the upload is
-- refused by the server with the tile still on screen; miss (3) and Postgres
-- refuses it after the file already reached R2.
--
-- Purely additive: the original 13 values are kept verbatim (real couples
-- already have rows under them), only 3 new values are appended. Per house
-- style (20260924000000_iteration_0010_moodboard_florals.sql widened
-- event_moodboard_saves.pillar the same way): DROP the old-named constraint,
-- ADD a _v2 with the wider IN-list, so the original constraint name still
-- documents what it once was and any future search for "_check" (not
-- "_check_v2") doesn't silently miss this one.

ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_slot_key_check;

ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_slot_key_check_v2;

-- ── 1-3 DESIGNS PER SLOT, NOT 2 ─────────────────────────────────────────────
-- Owner, 2026-09-03, on how couples actually use the board: *"most of the time,
-- they upload more that 1 design … it usually is 1-3 designs"* — so the
-- original 2-position cap (20260627000000) clipped the top of the real range.
--
-- ⚠ THE READ PATH WAS THE DANGEROUS HALF, NOT THIS CHECK. `listMoodboardSlots`
-- (wizard-actions.ts) filters returned rows to the allowed positions and
-- SILENTLY DROPS anything else — so widening only this constraint, without the
-- TypeScript side, would have let a couple's third photo save to R2 and this
-- table and then never appear on the page: a successful upload that renders as
-- nothing. Both halves move together via MOODBOARD_SLOT_POSITIONS, which is now
-- the single place the cap is written.
--
-- The partial UNIQUE(event_id, slot_key, slot_position) WHERE removed_at IS NULL
-- from 20260627000000 keeps holding — it is position-agnostic, so a third
-- position needs no index change.
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_slot_position_check;

ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_slot_position_check_v2;

ALTER TABLE public.event_inspiration_assets
  ADD CONSTRAINT event_inspiration_assets_slot_position_check_v2
  CHECK (slot_position IN (1, 2, 3));

ALTER TABLE public.event_inspiration_assets
  ADD CONSTRAINT event_inspiration_assets_slot_key_check_v2
  CHECK (slot_key IN (
    'venue','tunnel','stage','table','ceiling','overall',
    'backdrop','flowers','cocktail','reception_venue',
    'palette',
    'groom','bride','principal_sponsor','entourage','parents','guests'
  ));
