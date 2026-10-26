-- ═══════════════════════════════════════════════════════════════════════════
-- BACKFILL — a +1 name no live +1 row has is put back in step with the rows
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚖ Owner, verbatim, 2026-10-26 (cale-ice, Juanita Sacdalan): "I deleted that
-- guest and added a new plus 1. It is still there?"
--
-- The trigger (20271288562348_a_plus_ones_name_is_their_row.sql) keeps every
-- FUTURE write in step. This fixes the copies that already disagree: a live
-- bringer whose `plus_one_name` names nobody on any of their live +1 rows gets
-- the copy the trigger would have written — the name of their oldest live NAMED
-- +1 row, or NULL when none has a name (`guest_plus_one_name_of_rows`).
--
-- Measured in prod 2026-10-26 (read-only, before this file): 14 live bringers
-- carry a copy; 11 match a live row (untouched); 3 do not — Juanita (her named +1
-- removed, a TBA seat in its place → NULL), one whose only +1 was removed (→ NULL),
-- and one whose seat was renamed after the copy was written (→ the seat's name).
--
-- NARROW: only rows whose copy matches NO live +1 row of theirs; a bringer who
-- never had a +1 row (an import's copy with no seat) is not touched. IDEMPOTENT:
-- a second run finds every copy matching and changes nothing.

UPDATE public.guests AS b
   SET plus_one_name = public.guest_plus_one_name_of_rows(b.guest_id)
 WHERE b.deleted_at IS NULL
   AND b.plus_one_of_guest_id IS NULL
   AND NULLIF(btrim(b.plus_one_name), '') IS NOT NULL
   -- had a +1 row at some point: the copy speaks for rows
   AND EXISTS (
     SELECT 1 FROM public.guests s
      WHERE s.plus_one_of_guest_id = b.guest_id
        AND s.guest_id <> b.guest_id
   )
   -- …and no LIVE one carries the name it says (as drawn, or as the two raw parts)
   AND NOT EXISTS (
     SELECT 1 FROM public.guests s
      WHERE s.plus_one_of_guest_id = b.guest_id
        AND s.guest_id <> b.guest_id
        AND s.deleted_at IS NULL
        AND lower(btrim(regexp_replace(b.plus_one_name, '\s+', ' ', 'g'))) IN (
              lower(COALESCE(public.guest_plus_one_seat_name(s.first_name, s.last_name, s.plus_one_name_confirmed_at), '')),
              lower(btrim(regexp_replace(concat_ws(' ', s.first_name, s.last_name), '\s+', ' ', 'g')))
            )
   )
   AND b.plus_one_name IS DISTINCT FROM public.guest_plus_one_name_of_rows(b.guest_id);
