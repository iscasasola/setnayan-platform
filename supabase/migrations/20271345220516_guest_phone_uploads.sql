-- guest_phone_uploads — guests add event-day photos and snippets from their own phone (guest upload v2).
--
-- Owner, 13 Nov 2026 (DECISION_LOG "GUESTS CAN ADD PHOTOS FROM THEIR PHONE TO THE EVENT"): a guest picks photos from
-- their phone's gallery; only photos taken on the event day go in; each costs the couple's credits at the upload price
-- (the camera price × PAPIC_UPLOAD_MULTIPLIER, `papicCaptureCost(…, 'upload')`); and the couple chooses whether those
-- photos show right away or wait until they check them. Rulings, 14 Nov (#7607): no taken-date → not allowed;
-- a video is trimmed on the phone to 3–10 s; "After I check" photos left unchecked stay out, and are NOT refunded.
--
-- ── TWO COLUMNS, NO NEW CAPTURE PATH ────────────────────────────────────────
-- A phone upload is an ordinary guest capture: the same route (/api/papic/guest-capture), the same one-transaction
-- record-and-spend (papic_record_guest_capture_and_spend), the same screen, the same derivatives. Only two facts are
-- new, and each gets one column.
--
-- 1 · events.papic_phone_uploads_held — the couple's choice. FALSE = "Right away" (the default: a guest's photo lands
--     like a camera shot); TRUE = "After I check". Read and written ONLY through the service role, after the caller
--     is proven a host (app/api/papic/phone-uploads/route.ts) or a guest of THIS event (the guest-capture route), so
--     it carries NO user grant — listed in lint-events-column-grants' NO_GRANT_NEEDED with that reason. Not granting
--     it also keeps `events_host` (an explicit projection computed from the grants) untouched.
--
-- 2 · papic_guest_captures.phone_upload — NULL for a camera shot (every existing row, unchanged). For a shot added from
--     the phone's gallery: 'live' (shown at once) · 'waiting' (held for the couple's check — the row is ALSO born
--     hidden, below) · 'kept' (the couple kept it) · 'left_out' (the couple left it out; it stays hidden).
--
-- ⚖ "WAITING" REUSES THE SHIPPED HIDE. A held row is written with hidden_at set, so every surface that already honours
--   the couple's Hide keeps it out without a line of change; Keep clears hidden_at. And hiding never refunds: the
--   per-guest ceiling and the pot meter deliberately do NOT filter hidden_at (20271184624871, 20271185324597) — which
--   is exactly the owner's ruling 4 ("their credits are not refunded").

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS papic_phone_uploads_held BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.events.papic_phone_uploads_held IS
  'Guest phone uploads (guest upload v2, owner 2026-11-13): FALSE = they show right away; TRUE = they wait, hidden, '
  'until the couple checks them (Keep / Leave out) when publishing the Recap. Service-role only — no user grant.';

ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS phone_upload TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'papic_guest_captures_phone_upload_chk'
  ) THEN
    ALTER TABLE public.papic_guest_captures
      ADD CONSTRAINT papic_guest_captures_phone_upload_chk
      CHECK (phone_upload IS NULL OR phone_upload IN ('live', 'waiting', 'kept', 'left_out'));
  END IF;
END $$;

COMMENT ON COLUMN public.papic_guest_captures.phone_upload IS
  'NULL = a camera shot. Otherwise the shot was added from the guest''s phone gallery (guest upload v2): '
  '''live'' shown at once · ''waiting'' held (hidden_at set) for the couple''s check · ''kept'' · ''left_out'' (stays '
  'hidden; credits are not refunded — owner 2026-11-14). Written by the service role only.';

-- The couple's review list: this event's phone uploads still waiting.
CREATE INDEX IF NOT EXISTS papic_guest_captures_phone_waiting_idx
  ON public.papic_guest_captures (event_id, captured_at)
  WHERE phone_upload = 'waiting';

COMMIT;
