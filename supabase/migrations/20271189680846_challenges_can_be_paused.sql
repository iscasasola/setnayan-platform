-- CHALLENGES CAN BE PAUSED, FOR THE MOMENTS EVERYBODY MUST BE WATCHING.
--
-- Prefix allocated by `pnpm migration:new`. Idempotent throughout.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- THE OWNER'S ASK, 2026-09-01
-- ═══════════════════════════════════════════════════════════════════════════
-- Verbatim: *"instead of just stop. let us also allow pause for the challenge.
-- so challenges can all be not available on moments everybody must be
-- watching."*
--
-- The vows, the first kiss, a parent's speech — the moments the celebration is
-- FOR. Nobody should be hunting a stranger for a selfie during them.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🛑 PAUSE IS NOT STOP, AND NEITHER OF THEM IS HIDE. THREE DIFFERENT ACTS.
-- ═══════════════════════════════════════════════════════════════════════════
--   HIDE   `papic_missions.is_active = false` — ONE challenge leaves every
--          guest's board for good. The couple's own editorial choice.
--   STOP   `papic_stop_challenge()` — ends the ONE armed prompt. Every
--          challenge, including that one, stays answerable. (Owner, same day:
--          "one challenge, but the other challenges may still be there.")
--   PAUSE  THIS. The whole board goes quiet, for EVERY guest, for as long as
--          the coordinator says — and comes back untouched.
--
-- 🔑 PAUSE IS THE ONLY ONE OF THE THREE THAT IS TEMPORARY AND EVENT-WIDE, which
-- is why it cannot be expressed with either of the others. Hiding ten
-- challenges to quiet a room and un-hiding them afterwards is ten destructive
-- writes to undo a two-minute silence, and any one of them failing leaves a
-- couple's board permanently wrong.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 A PAUSE CLOSES PROMPTS. IT DOES NOT CLOSE THE SHUTTER.
-- ═══════════════════════════════════════════════════════════════════════════
-- The first kiss is the single most photographed second of the day. A pause
-- that stopped the camera would silence the challenges by throwing away the
-- pictures the whole product exists to collect.
--
-- ⚠ SO NOTHING ON THE CAPTURE PATH MAY EVER READ THIS COLUMN.
-- `papic_record_guest_capture`, `papic_record_seat_capture` and
-- `papic_complete_mission` are untouched here and must stay untouched — the
-- same line item 4a drew, and a db test asserts it against the shipped
-- function bodies rather than against this comment.
--
-- ⚠ AND `papic_guest_missions` IS UNTOUCHED TOO — DELIBERATELY.
-- Owner's ruling on what a paused guest sees (2026-09-01): the board STAYS,
-- with a notice over it. An empty board is byte-identical to a celebration
-- that never set any challenges up, and shipping "not available" as an absence
-- is this project's signature defect. So the SQL keeps returning the same rows
-- and the SCREEN says what is going on. A db test asserts the guest's board is
-- unchanged across a pause.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY A COLUMN ON `events` AND NOT A NEW TABLE
-- ═══════════════════════════════════════════════════════════════════════════
-- RULE 0.3 — a flag beats new schema. It is ONE nullable fact about ONE
-- celebration, it sits beside the other Papic switches the couple already owns
-- (`papic_uploads_open`, `papic_captures_hidden`, `papic_vendor_challenges_enabled`),
-- and `events` already carries the RLS that governs who may set it.
--
-- 🔎 CHECKED FIRST, because a second switch for one fact is worse than none:
-- `papic_uploads_open` is whether guests may UPLOAD from their gallery;
-- `papic_captures_hidden` is whether captures are shown; both are durable
-- settings, not a two-minute silence, and neither has anything to say about
-- prompts. `vendor_profiles.papic_challenge_expires_at` is a SHOP'S 28-day
-- subscription and is not about this celebration at all.
--
-- A TIMESTAMPTZ rather than a BOOLEAN, mirroring
-- `papic_guest_spend_ceiling_released_at`: "paused, and since when" answers a
-- question the coordinator will actually ask mid-reception, and NULL is an
-- unambiguous "running". It is NOT a clock — nothing derives an end from it,
-- there is no duration, and a pause ends only when somebody resumes it (owner:
-- manual only).

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS papic_challenges_paused_at TIMESTAMPTZ;

COMMENT ON COLUMN public.events.papic_challenges_paused_at IS
  'When the coordinator paused ALL Papic challenges for this celebration, so '
  'the room can watch the moment instead of playing (owner 2026-09-01). NULL = '
  'running. Manual only: nothing derives an end from this, there is no '
  'duration, and it clears when somebody resumes. 🔴 PROMPTS ONLY — no capture '
  'path may read it; a guest is never refused a photo because the challenges '
  'are quiet. The guest''s board is NOT emptied while paused (papic_guest_missions '
  'is untouched): the screen says so instead, because an empty board is '
  'indistinguishable from a celebration with no challenges. NOT '
  'papic_missions.is_active (hiding one challenge for good) and NOT '
  'papic_stop_challenge() (ending the one armed prompt).';

-- ═══════════════════════════════════════════════════════════════════════════
-- 🔒 THE GRANTS — WITHOUT THESE THE COLUMN IS BORN UNREADABLE
-- ═══════════════════════════════════════════════════════════════════════════
-- `public.events` REVOKES table-level SELECT and re-grants a COLUMN ALLOWLIST
-- computed at apply time (20271007100000 / 20271025120000), so a new column
-- holds NO grant unless this migration says so — and the PGlite replay cannot
-- catch it, because re-applying the lockdown recomputes the allowlist over
-- whatever columns exist by then. `site_art_direction` was refused to every
-- signed-in person for over a month exactly this way.
--
-- SELECT: the run of show reads it to say whether challenges are paused.
-- UPDATE: the pause/resume action writes it as the coordinator, under the
-- event's own RLS. Both are needed; granting one is the shape of the
-- `recur_cadence` defect (write-only, and the read blanked every screen).
GRANT SELECT (papic_challenges_paused_at) ON public.events TO authenticated;
GRANT UPDATE (papic_challenges_paused_at) ON public.events TO authenticated;

-- ⚠ NOT GRANTED TO `anon`, ON PURPOSE. A guest never reads this column
-- directly: `/api/papic/guest-missions` already runs SERVER-SIDE on the
-- service-role client against the guest's own cookie-derived event, so the
-- pause reaches their screen without the anon surface growing by one column.

-- ═══════════════════════════════════════════════════════════════════════════
-- 🔁 REBUILD `events_host` — ITS PROJECTION IS AN EXPLICIT COLUMN LIST
-- ═══════════════════════════════════════════════════════════════════════════
-- Hosts read events through this view, and it names its columns explicitly, so
-- a column added without rebuilding it is a PHANTOM there — and
-- `/dashboard/[eventId]/details` THROWS on a query error rather than degrading,
-- which would kill Personalization for every host on every event type.
--
-- 🔑 I DID NOT KNOW THIS AND DID NOT WORK IT OUT; `lint-events-column-grants.mjs`
-- said so, by name, in the same run that checked the grants. The block below is
-- copied from 20271025120000 rather than paraphrased, because the projection is
-- COMPUTED FROM THE GRANTS and a hand-written column list would be a second,
-- immediately-stale statement of what a host may read.
DROP VIEW IF EXISTS public.events_host;

DO $$
DECLARE
  private_columns TEXT[] := ARRAY[
    'partner_a_birth_date','partner_a_birth_time',
    'partner_b_birth_date','partner_b_birth_time',
    'bazi_birthdata_consent_at',
    'estimated_budget_centavos','budget_band',
    'wizard_state',
    'photo_delivery_folder_id','photo_delivery_folder_name',
    'photo_delivery_account_email',
    'setnayan_ai_tier_at_purchase',
    'signature_details','honoree_label','honoree_dependent_id'
  ];
  projected TEXT;
BEGIN
  SELECT string_agg('e.' || quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO projected
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'events'
    AND (
      has_column_privilege('authenticated', 'public.events', c.column_name, 'SELECT')
      OR c.column_name = ANY (private_columns)
    );

  IF projected IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed events_host projection is empty';
  END IF;

  EXECUTE format($ddl$
    CREATE VIEW public.events_host
      WITH (security_invoker = false)
      AS
      SELECT %s
        FROM public.events e
       WHERE e.event_id IN (SELECT public.current_couple_event_ids())
          OR e.event_id IN (SELECT public.current_moderator_event_ids())
          -- service_role only, named EXPLICITLY. NOT `auth.uid() IS NULL` —
          -- that is also true for anon, which would hand every row to an
          -- unauthenticated caller. Reproduced verbatim from 20271008731642.
          OR current_user = 'service_role'
          OR auth.role() = 'service_role'
  $ddl$, projected);
END $$;

-- The REVOKE from authenticated before the GRANT is what keeps a recreated view
-- from inheriting anything wider than SELECT.
REVOKE ALL ON public.events_host FROM PUBLIC;
REVOKE ALL ON public.events_host FROM anon;
REVOKE ALL ON public.events_host FROM authenticated;
GRANT SELECT ON public.events_host TO authenticated, service_role;

COMMENT ON VIEW public.events_host IS
  'Couple/moderator-scoped read path for events, including the columns denied to authenticated on the base table (20271008731642 + 20271025120000: birth data, budget, wizard_state, Drive folder, AI tier, signature_details, honoree_label, honoree_dependent_id). Guests, vendors and coordinators get ZERO rows. security_invoker=false by design.';

COMMIT;
