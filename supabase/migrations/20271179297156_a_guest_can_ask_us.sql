-- ============================================================================
-- 20271179297156_a_guest_can_ask_us.sql
--
-- A GUEST CAN ASK FOR A PHOTOGRAPH OF THEMSELVES TO BE TAKEN DOWN.
--
-- ─── WHAT A GUEST HAD BEFORE ────────────────────────────────────────────────
-- One button, "Not me", on every photograph in their own gallery — and it could
-- not work on any of them.
--
-- 🔴 MEASURED, NOT INFERRED. `removeMyTag` filters `source = 'auto_face'`, so it
-- only ever detached a FACE-RECOGNITION guess. Production holds **2 photo tags
-- in total and both are `manual_pick`; there has never been a single
-- `auto_face` tag**, because face matching is switched off on every event. So
-- the control rendered on every photo, said "Removing…", revalidated the page,
-- and left the photograph exactly where it was. No error, no explanation.
--
-- ⚖ **A DEAD CONTROL IS BAD ANYWHERE AND WORST HERE**: it is the button a person
-- presses at the moment they object to their own image being used.
--
-- ─── AND THE QUEUE HAD NO WORD FOR IT ───────────────────────────────────────
-- `user_reports.reason` allowed nudity_sexual · violence · hate_harassment ·
-- spam · not_my_event · other. A guest withdrawing consent to their own likeness
-- is none of those. They would have had to file `other`, arriving in the
-- moderation queue indistinguishable from spam — and this is the one report
-- carrying a statutory clock, because RA 10173 gives the data subject the right
-- to object and the consent box we show them says so out loud.
--
-- 🔑 THE TABLE WAS ALREADY BUILT FOR THIS PERSON. `user_reports.reporter_guest_id`
-- has existed since 20261108000000 — a report filed by somebody with no account,
-- which is exactly what a guest who scanned a QR at a wedding is. Nothing here
-- invents a mechanism; it adds the one word that was missing from it.
--
-- ⛔ AND IT IS DELIBERATELY NOT OFFERED EVERYWHERE. The other report entries — a
-- chat thread, a public profile, a creator chapter — are not photographs OF the
-- person pressing the button, so this reason is meaningless there and is not
-- added to their lists. One new value, one new place to choose it.
-- ============================================================================

BEGIN;

ALTER TABLE public.user_reports
  DROP CONSTRAINT IF EXISTS user_reports_reason_check;

/*
  ⚠ THE FIVE EXISTING VALUES ARE REPRODUCED EXACTLY. A DROP + ADD on a CHECK is
  the only way to widen one, which means the whole list is retyped — and a value
  quietly missing from the retype does not fail: it silently makes every EXISTING
  row of that kind un-writable, and this table already holds reports. The list
  below was read out of production with `pg_get_constraintdef`, not remembered.
*/
ALTER TABLE public.user_reports
  ADD CONSTRAINT user_reports_reason_check CHECK (
    reason = ANY (ARRAY[
      'nudity_sexual'::text,
      'violence'::text,
      'hate_harassment'::text,
      'spam'::text,
      'not_my_event'::text,
      'remove_my_likeness'::text,
      'other'::text
    ])
  );

COMMENT ON COLUMN public.user_reports.reason IS
  'Why this was reported. `remove_my_likeness` is the data subject''s own objection to a photograph of themselves (RA 10173 right to object) — it is NOT abuse, it carries a statutory clock, and it is filed only from the guest''s own gallery on the event page. Every other value is a moderation report.';

COMMIT;
