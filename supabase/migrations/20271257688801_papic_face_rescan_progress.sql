-- papic_face_rescan_progress
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)




-- ─────────────────────────────────────────────────────────────────────────────
-- THE ONE END-OF-EVENT FACE RESCAN — WHERE IT HAS GOT TO.
--
-- ⚖ Owner 2026-09-30 (DECISION_LOG "FACE DATA: THREE OWNER ANSWERS" (3), and
-- his answer to PR #6195: *"2. a"*): after the event ends, ONE server-side pass
-- checks every photo of the event against every registered selfie, before Papic
-- closes 12 hours later — "nothing stored about unregistered faces".
--
-- The pass runs in bounded slices (a photo batch and a time budget per run, on
-- request traffic — this repo has no scheduler), so it must remember where it
-- stopped. This table is that memory and NOTHING ELSE:
--   • two cursors — the last `papic_photos.id` and `papic_guest_captures.id`
--     already scanned;
--   • two counters — photos scanned, tags written (so "did it run, and did it
--     finish" is answerable);
--   • when it started and when it finished.
--
-- 🔒 NO FACE DATA, BY CONSTRUCTION. There is no column that could hold a
-- descriptor, a box, a count of faces in a photo, or anything about a person
-- who did not register. Descriptors computed during the pass live in memory
-- only; the one thing a match writes is a `photo_tags` row for a guest who
-- REGISTERED a selfie (lib/face-match.ts). `face-rescan-stores-no-bystander.test.ts`
-- holds the column list.
--
-- SERVICE ROLE ONLY: RLS on with NO policy, and every grant to anon /
-- authenticated revoked — no browser path reads or writes it. Rows go with
-- their event (ON DELETE CASCADE).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.papic_face_rescan_progress (
  event_id        uuid PRIMARY KEY REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- Cursor positions: the scan starts at 0 and walks each table by id.
  last_photo_id   bigint NOT NULL DEFAULT 0,
  last_capture_id bigint NOT NULL DEFAULT 0,
  photos_scanned  integer NOT NULL DEFAULT 0,
  tags_written    integer NOT NULL DEFAULT 0,
  started_at      timestamptz NOT NULL DEFAULT now(),
  -- NULL while the pass is still walking; set when both cursors reach the end.
  finished_at     timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.papic_face_rescan_progress ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.papic_face_rescan_progress FROM PUBLIC;
REVOKE ALL ON public.papic_face_rescan_progress FROM anon;
REVOKE ALL ON public.papic_face_rescan_progress FROM authenticated;
GRANT ALL ON public.papic_face_rescan_progress TO service_role;

COMMENT ON TABLE public.papic_face_rescan_progress IS
  'Where the one end-of-event face rescan has got to (owner 2026-09-30, "2. a"): per-event cursors into papic_photos / papic_guest_captures, scan/tag counters, start and finish times. Holds NO face data — descriptors live in memory during the pass and only photo_tags for REGISTERED guests are written. Service role only.';
