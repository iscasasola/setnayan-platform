-- ============================================================================
-- 20271267138064_guests_schedule_read_is_for_everyone.sql
-- Created via `pnpm migration:new`. Idempotent (DROP POLICY IF EXISTS + CREATE).
--
-- 🔒 THE DATABASE'S ANONYMOUS SCHEDULE READ KEEPS THE AUDIENCE FENCE.
--
-- A schedule moment can be made "Only for · Entourage / Sponsors / Family /
-- Suppliers" (`event_schedule_blocks.audience`, 20271265788160; NULL =
-- Everyone, and 'everyone' is never stored). The owner's rule (DECISION_LOG
-- 2026-10-06 "STUDIO › SCHEDULE AND LOVE STORY"): a moment for a role is shown
-- only to that role; the guests' schedule shows only the Everyone moments.
--
-- The pages keep that rule (`onlyWhatGuestsMaySee` in lib/schedule.ts, #6467):
--   is_public = true · audience IS NULL · visibility <> 'coordinator_only'
-- The database did not. The anonymous policy, last defined in 20270901120000,
-- was `is_public = TRUE AND visibility <> 'coordinator_only'` — it never asked
-- `audience`, so anyone holding the public anon key and an event id could ask
-- PostgREST directly for a role-only moment's label, times, location and
-- tagged suppliers, whatever the pages drew. (20271265788160's header chose the
-- inherited COLUMN grant as "nothing more private than the row's label" — true
-- for the column; this file fixes the ROW rule, which is where the fence goes.)
--
-- RLS_Policy_Pattern.md § 6 "Anonymous public reads": scope tightly — published
-- AND "any role-specific visibility rule". This adds the role rule; the other
-- two conditions are copied verbatim from 20270901120000.
--
-- ONLY the anonymous policy changes. UNCHANGED, on purpose — a host, a
-- coordinator and a booked supplier read exactly what they read before:
--   · event_schedule_blocks_couple_read          (20270901120000)
--   · event_schedule_blocks_booked_vendor_read   (20270901120000)
--   · event_schedule_blocks_moderator_read       (20271262573732)
--   · event_schedule_blocks_couple_write / _moderator_write
-- The service-role reads (the Event Hub's schedule, the Story) bypass RLS and
-- carry the same fence in app code (#6467); this policy is the floor under the
-- anon-key path: the guests' live "Now · Up next" refetch
-- (`fetchRunOfShowBlocks` on the visitor's own session) and its realtime
-- channel, and anyone calling PostgREST with the public key.
--
-- Reversible: recreate the policy without `AND audience IS NULL`.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS event_schedule_blocks_public_read ON public.event_schedule_blocks;
CREATE POLICY event_schedule_blocks_public_read
  ON public.event_schedule_blocks FOR SELECT
  TO anon
  USING (
    is_public = TRUE
    AND visibility <> 'coordinator_only'
    AND audience IS NULL
  );

COMMENT ON POLICY event_schedule_blocks_public_read ON public.event_schedule_blocks IS
  'Guests (anon): a moment that is public, released (not coordinator_only) and for Everyone (audience IS NULL). '
  'The same three conditions as onlyWhatGuestsMaySee (lib/schedule.ts). 20271267138064.';

-- The fence must really be in the policy that was just written.
DO $$
DECLARE
  q TEXT;
BEGIN
  SELECT pg_get_expr(p.polqual, p.polrelid) INTO q
    FROM pg_policy p
   WHERE p.polrelid = 'public.event_schedule_blocks'::regclass
     AND p.polname = 'event_schedule_blocks_public_read';
  IF q IS NULL OR q NOT LIKE '%audience IS NULL%' THEN
    RAISE EXCEPTION 'event_schedule_blocks_public_read does not ask audience: %', q;
  END IF;
END $$;

COMMIT;
