-- ═══════════════════════════════════════════════════════════════════════════
-- BACKFILL — the +1 seats a guest was allowed but never given (ONE TIME, DATA)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚖ Owner, verbatim, 2026-10-21: "why does Ronald Dane Llarena have a +1 but no
-- row under him" → on the missing rows: "fix it".
--
-- ⛔ A DATA CHANGE ON LIVE EVENTS — it merges only on the owner's word (draft PR,
-- do-not-auto-merge). It is its own file so it can be read, held or dropped alone.
--
-- WHAT IT DOES. For every live guest who is not a +1 and whose number
-- (`plus_one_count`) is above their live +1 rows, it mints the missing "TBA"
-- seats through the ONE seat writer, `guest_plus_one_seats_follow_count`
-- (20271281805227 — the same advisory lock as the reply's seat mint). That
-- function only ever ADDS placeholders here (the number is above the rows), so:
--   · it never touches a named +1;
--   · it never lowers a number and never removes anything.
--
-- WHAT IT SKIPS, ON PURPOSE:
--   · a guest who has a REMOVED +1 row — the host took that seat away. Since the
--     2026-10-20 ruling "removing a +1 takes their seat with them" the number
--     should have gone down with it; giving them a fresh "TBA" would undo the
--     host's remove. Measured 2026-10-21: Juanita and Maxima Sacdalan (cale-ice),
--     each +1, each seat removed 2026-10-14 — LEFT for the owner (lower their
--     number, or give the seat back).
--   · a guest on a FINALIZED list (`events.guest_count_locked_at`) — the head
--     count suppliers priced against is closed; adding a row there is the owner's
--     call, not a backfill's. (0 such guests measured.)
--
-- 📏 MEASURED IN PROD 2026-10-21, read-only, before writing this:
--     cale-ice · Antonio Loo     · +1 · 0 rows ever  → minted 1
--     cale-ice · Ronald Llarena  · +1 · 0 rows ever  → minted 1
--     cale-ice · Juanita Sacdalan· +1 · 1 removed    → skipped (above)
--     cale-ice · Maxima Sacdalan · +1 · 1 removed    → skipped (above)
--   No other event has a guest whose number is above their rows.
--   Expected after: 2 new "TBA" +1 rows on cale-ice, nothing else changed.
--
-- IDEMPOTENT: a second run finds every included guest's rows equal to their
-- number and mints nothing (tests/db/plus-one-seats-backfill.db.test.ts).
--
-- The new rows are unseated; the seat engine puts them beside their guest the
-- next time that guest's seats are reconciled (`syncExtraSeats`).

DO $backfill$
DECLARE
  v_guest   UUID;
  v_out     JSONB;
  v_made    INTEGER := 0;
  v_guests  INTEGER := 0;
BEGIN
  FOR v_guest IN
    SELECT g.guest_id
      FROM public.guests g
      JOIN public.events e ON e.event_id = g.event_id
     WHERE g.deleted_at IS NULL
       AND g.plus_one_of_guest_id IS NULL
       AND g.plus_one_count > 0
       AND e.guest_count_locked_at IS NULL
       AND g.plus_one_count > (
             SELECT COUNT(*) FROM public.guests s
              WHERE s.plus_one_of_guest_id = g.guest_id AND s.deleted_at IS NULL)
       AND NOT EXISTS (
             SELECT 1 FROM public.guests r
              WHERE r.plus_one_of_guest_id = g.guest_id AND r.deleted_at IS NOT NULL)
     ORDER BY g.created_at, g.guest_id
  LOOP
    v_out := public.guest_plus_one_seats_follow_count(v_guest);
    v_made := v_made + COALESCE((v_out->>'created')::INTEGER, 0);
    v_guests := v_guests + 1;
  END LOOP;
  RAISE NOTICE 'backfill_missing_plus_one_seats: % guest(s), % seat(s) minted', v_guests, v_made;
END $backfill$;
