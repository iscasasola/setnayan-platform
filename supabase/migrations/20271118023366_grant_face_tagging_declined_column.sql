-- The couple's face-tagging opt-out card renders on NOTHING, on every event.
--
-- All five production events are in the mode where the card is supposed to
-- appear. It appears on none of them. The card reads three columns from
-- `events` with the SIGNED-IN client; two are readable and the third,
-- `face_tagging_declined_by_couple`, is not — so PostgREST 403s the whole
-- query and the component's `if (error || !data) return null` hides it.
--
-- 🪤 The card was written to hide itself when the choice does not apply. That
-- honest behaviour is exactly what made this invisible: a missing card reads as
-- "not applicable here", not as "the query failed".
--
-- 🚨 DO NOT TAKE POSTGRES'S OWN ADVICE HERE. The live error text ends with
-- "hint: Grant the required privileges to the current role with: GRANT SELECT
-- ON public.events TO authenticated;" — following that hint would hand every
-- signed-in user the whole row, including the encrypted photo-delivery OAuth
-- token, the master QR token, both partners' birth dates and the couple's
-- budget. Those 23 columns are withheld ON PURPOSE; the other 176 already carry
-- column-level SELECT. This grants the ONE column the card needs.
--
-- Row access is unchanged: `events` RLS still limits a couple to their own
-- event. A column grant widens WHICH FIELDS, never WHOSE ROWS.

GRANT SELECT (face_tagging_declined_by_couple) ON public.events TO authenticated;

COMMENT ON COLUMN public.events.face_tagging_declined_by_couple IS
  'The couple declined face auto-tagging for this event. Column-level SELECT is '
  'granted to authenticated (2026-08-06) because the opt-out card reads it with '
  'the signed-in client; without it the whole query 403''d and the card silently '
  'rendered nothing on every event. NOT a table grant — 23 columns on this table '
  'are deliberately withheld.';
