-- a_chapter_time_can_be_tba
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 📖 A CHAPTER'S TIME MAY BE TBA (owner 2026-11-01, ruled yes; corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01 §2
-- "Blank start = Time TBA", §3 "Chapter time TBA = no call time", §12 Step 3).
--
-- 🔑 WHY A FLAG AND NOT A NULL `start_at`. A chapter with no time still has a DAY: the day decides whether it lives on
-- Event Day or in Planning Stage (plan §3 "A chapter dated before the day lives in Planning Stage"). A NULL start would
-- lose the day, and `start_at` is NOT NULL under ~70 readers, three triggers (the date move, the advance, the
-- chapter move) and a CHECK (`end_at > start_at`). So the day stays in `start_at` (at 00:00, the wall-clock
-- convention every schedule write already uses) and `time_tba` says the clock part is not known.
--
-- 🛑 NO GUESSED HOUR REACHES A GUEST. A reader that does not know this flag would draw a TBA chapter at 12:00 AM. Every
-- guest-facing reader filters `is_public`, so a TBA chapter can never be shown to guests (CHECK below): the
-- placeholder midnight cannot reach the Event Hub. Showing it is refused by the database until its time is set.
--
-- Also refused: a TBA MOMENT (only a chapter — a top-level block — may be TBA), and a TBA chapter with an end (an end
-- with no start is a guess too). Ingress and egress are minutes from the start; the Schedule's door clears them when a
-- chapter goes TBA.
--
-- Held by apps/web/tests/db/a-chapter-time-can-be-tba.db.test.ts.

BEGIN;

ALTER TABLE public.event_schedule_blocks
  ADD COLUMN IF NOT EXISTS time_tba BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.event_schedule_blocks
  DROP CONSTRAINT IF EXISTS event_schedule_blocks_time_tba_check;

ALTER TABLE public.event_schedule_blocks
  ADD CONSTRAINT event_schedule_blocks_time_tba_check
    CHECK (
      NOT time_tba
      OR (parent_block_id IS NULL AND end_at IS NULL AND is_public = FALSE)
    );

COMMENT ON COLUMN public.event_schedule_blocks.time_tba IS
  'Chapter (top-level) only: the time is not known yet (Time TBA, no call time). start_at keeps the DAY at 00:00. Never shown to guests while set. 20271300482585.';

COMMIT;
