-- repeat_cadence — a repeat is a CADENCE, not a yes/no
--
-- Owner, 2026-08-15: *"so, I can be like a reminder app. that can repeat
-- monthly, annually, quarterly, weekly, semestral? but only choose events that
-- this can work. Birthday, anniversary can only be annual. and so on."*
--
-- ── WHY A COLUMN AND NOT A FLAG FLIP ────────────────────────────────────────
-- RULE 0 in this repo says a flag/filter flip beats new schema, so that was
-- checked first: `events.recurs` is BOOLEAN NOT NULL DEFAULT FALSE, and a
-- boolean cannot carry five values. A repo-wide search for an existing interval
-- (`rrule` · `recur_interval` · `frequency` · `cadence` · `quarterly` ·
-- `semestral` · `every_n` …) across supabase/migrations and apps/web returned
-- ZERO event-related hits — the only matches are vendor SKU billing cycles, BIR
-- quarterly filings, sitemap changefreq and a UI timer. So the column is
-- genuinely required, and it is the ONLY new storage this feature needs.
--
-- `recurs` is deliberately KEPT as the on/off it already is, so all five shipped
-- readers keep working untouched. The cadence answers "how often", never
-- "whether".
--
-- ⚠ TEXT + CHECK, NOT AN ENUM — matching `anchor_kind` and `anchor_origin` next
-- to it. This project already had to drop `public.event_type` for being an
-- unextendable enum (20261205000000); a sixth cadence must be one ALTER, not a
-- type migration.
--
-- ⚠ STILL NOT AN RRULE ENGINE. Owner-locked 2026-07-12 and restated in this
-- table's own column comment: recurrence is DERIVED at read time and NEVER
-- auto-creates an event row. Five cadences means five derivations on the Year
-- view, not a scheduler writing rows.

-- ── 1 · the cadence ─────────────────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recur_cadence TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_recur_cadence_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_recur_cadence_check CHECK (
        recur_cadence IS NULL
        OR recur_cadence IN ('weekly', 'monthly', 'quarterly', 'semestral', 'annual')
      );
  END IF;
END $$;

-- A cadence without the switch on is a value nothing reads — the shape that
-- produced this repo's "gate with no handle" family five times. The database
-- refuses it rather than trusting every future writer to pair them.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_recur_cadence_needs_recurs'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_recur_cadence_needs_recurs CHECK (
        recur_cadence IS NULL OR recurs = TRUE
      );
  END IF;
END $$;

-- ── 🚨 THE GRANT, WITHOUT WHICH THE EDIT SCREEN IS A DEAD BUTTON ────────────
-- `events` REVOKES table-level UPDATE/INSERT and re-grants a computed COLUMN
-- ALLOWLIST (20271005100000). That allowlist was computed from
-- information_schema AT THAT MIGRATION'S TIME, so a column added later holds
-- **no privilege at all** unless it is granted explicitly.
--
-- PROVED, NOT ASSUMED — probed against production in a rolled-back transaction:
-- adding a fresh column to `events` and reading back its privileges returned
-- **0 UPDATE grants for `authenticated`**. Without the two lines below, the new
-- Personalization control would post, PostgREST would REJECT the write for lack
-- of privilege, and — because a rejection resolves as an error rather than
-- throwing — the person would be told to try again, forever. That is exactly
-- the `location_city` defect of 2026-08-11: a field added to the app and to the
-- locked-field list but never to the constraint it had to pass.
--
-- 🔑 The RLS policy is not the control here. `couple_can_update_event` already
-- admits the ROW; the GRANT is what admits the FIELD.
--
-- 🚨 AND SELECT IS NOT OPTIONAL EITHER — I GRANTED WRITE AND FORGOT READ.
-- `events` revokes table-level SELECT too and re-grants its own column
-- allowlist (20271007100000 / 20271008731642 / 20271025120000). Measured in
-- production: `authenticated` holds SELECT on **177 of 191** columns. The Year
-- page and the home "This year" strip both read `recur_cadence` through the
-- USER-scoped client, so without this line Postgres refuses the whole select,
-- supabase-js resolves `{data: null, error}`, `rows ?? []` becomes `[]`, and
-- **every signed-in person's entire Year view goes blank** — wedding countdown,
-- anniversaries, birthdays, monthsaries, all of it. Not the new feature failing:
-- the existing one disappearing.
GRANT SELECT (recur_cadence) ON public.events TO authenticated;
GRANT UPDATE (recur_cadence) ON public.events TO authenticated;
GRANT INSERT (recur_cadence) ON public.events TO authenticated;
-- ⚠ `anon` is deliberately given nothing. A signed-out visitor has no year.

-- ── 🚨 AND THE HOST VIEW MUST BE REBUILT, OR THE WHOLE PAGE 500s ────────────
-- `public.events_host` is a VIEW with an EXPLICIT 191-column projection, not
-- `SELECT *`. The Personalization page reads `.from('events_host')` and throws
-- on a query error, so a column that exists on the base table but not in the
-- view is a phantom column — PostgREST rejects, the page throws, and **every
-- host loses Personalization entirely**: names, region, budget, mood, BaZi, and
-- the repeat control this change exists to ship.
--
-- 🔑 THE PROJECTION IS COMPUTED FROM `has_column_privilege(...,'SELECT')`, so
-- the GRANT above must come FIRST and then this rebuild picks the column up
-- automatically. Reproduced from 20271025120000 — the private-column list and
-- the REVOKE-before-GRANT are copied verbatim, because a recreated view that
-- inherits wider privileges is exactly what that block exists to prevent.
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

  IF projected NOT LIKE '%recur_cadence%' THEN
    RAISE EXCEPTION 'refusing to apply: recur_cadence missing from the events_host projection — the GRANT above did not take';
  END IF;

  EXECUTE format($ddl$
    CREATE VIEW public.events_host
      WITH (security_invoker = false)
      AS
      SELECT %s
        FROM public.events e
       WHERE e.event_id IN (SELECT public.current_couple_event_ids())
          OR e.event_id IN (SELECT public.current_moderator_event_ids())
          OR current_user = 'service_role'
          OR auth.role() = 'service_role'
  $ddl$, projected);
END $$;

REVOKE ALL ON public.events_host FROM PUBLIC;
REVOKE ALL ON public.events_host FROM anon;
REVOKE ALL ON public.events_host FROM authenticated;
GRANT SELECT ON public.events_host TO authenticated, service_role;

COMMENT ON VIEW public.events_host IS
  'Couple/moderator-scoped read path for events, including the columns denied to authenticated on the base table (20271008731642 + 20271025120000: birth data, budget, wizard_state, Drive folder, AI tier, signature_details, honoree_label, honoree_dependent_id). Guests, vendors and coordinators get ZERO rows. security_invoker=false by design.';

COMMENT ON COLUMN public.events.recur_cadence IS
  'HOW OFTEN this event returns: weekly · monthly · quarterly · semestral · annual. '
  'NULL with recurs=TRUE reads as ''annual'' — the only meaning recurs ever had, so '
  'every row written before 2026-08-15 keeps its behaviour without a backfill. '
  'Which cadences a given event_type may use is authored in '
  'apps/web/lib/event-anchor.ts (CADENCES_BY_TYPE) — the ONE per-type map. '
  'NOT an RRULE engine: occurrences are derived at read time and no event row is '
  'ever auto-created (owner-lock 2026-07-12).';

-- ⚠ NO BACKFILL, DELIBERATELY. NULL is already the correct value for every
-- existing row: with recurs=TRUE it reads as annual (what the boolean meant),
-- and with recurs=FALSE the second CHECK forbids anything else. Measured before
-- writing this: all 5 prod events have recurs=false, so the set to backfill is
-- empty either way.

-- ── 1b · repair the birthdays the old three-way disagreement broke ──────────
-- 🔴 A BIRTHDAY CREATED FROM THE CREATE-EVENT GRID STORED `recurs = false`.
-- The old rule was `isAnniversary || (canToggleRecur(type) && checkbox)` and
-- `canToggleRecur` has never included 'birthday' — while the ONBOARDING path
-- set it TRUE for the same type. The Year view's birthday branch requires
-- `recurs`, so those birthdays never appeared on the surface built for them,
-- and with no UPDATE path they could never be corrected.
--
-- Fixing the code only fixes NEW ones. This repairs the existing rows, because
-- the alternative is a screen that states "this returns every year" over data
-- that says otherwise, repaired only if the person happens to open
-- Personalization and press Save.
--
-- ✅ SAFE BY DEFINITION, not by luck: birthday and anniversary are the two types
-- whose repeat is definitional (FORCED_RECUR_TYPES) — there is no legitimate
-- non-recurring birthday, so this cannot overwrite a real choice. It touches
-- nothing else. Measured: prod holds zero rows of either type today, so this is
-- protection for anything created between now and deploy rather than a bulk
-- rewrite.
UPDATE public.events
   SET recurs = TRUE
 WHERE event_type IN ('birthday', 'anniversary')
   AND recurs IS DISTINCT FROM TRUE;

-- ── 2 · 🔴 the death-anniversary door, closed ───────────────────────────────
-- `anchor_origin = 'matters'` ("A date that matters to us") is the free-form
-- catch-all the 2026-07-12 flow-check council ruled must go, verbatim:
--
--   "A user can enter a parent's death anniversary; #3176 then fires an annual
--    reminder = a death-anniversary tracker, exactly what 2026-05-16 killed.
--    Winner: the burial-retirement lock. Drop the catch-all origin and the
--    free-label … Label-only guardrails don't hold."
--
-- The owner accepted that verdict. **It never reached the code**: the CHECK
-- still admitted 'matters', the TS constant still carried it, and it was
-- rendered on two screens. A per-event CADENCE is exactly the widening that
-- makes it live — any date + 'matters' + annual + the shipped anniversary email
-- IS the retired product, rebuilt by accident.
--
-- Removing the option is the mechanism; a comment would not be one.
--
-- ✅ SAFE BY MEASUREMENT, NOT BY HOPE: `SELECT anchor_origin, count(*) FROM
-- events GROUP BY 1` in production returned exactly one row — (NULL, 5). No row
-- anywhere uses 'matters', so nothing is stranded and no data is rewritten.
DO $$
BEGIN
  -- ⚠ CHECK BEFORE DROPPING, not after. `supabase db push` runs a migration in a
  -- transaction so an abort would roll the DROP back either way — but a block
  -- that removes a constraint and only then asks whether it was safe is one
  -- `--single-transaction` flag away from leaving the table unguarded. Order it
  -- so the guarantee does not depend on how it is invoked.
  IF EXISTS (SELECT 1 FROM public.events WHERE anchor_origin = 'matters') THEN
    RAISE EXCEPTION
      'events.anchor_origin = ''matters'' still has rows — resolve them before retiring the origin';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_anchor_origin_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events DROP CONSTRAINT events_anchor_origin_check;
  END IF;

  ALTER TABLE public.events
    ADD CONSTRAINT events_anchor_origin_check CHECK (
      anchor_origin IS NULL
      OR anchor_origin IN ('wedding', 'relationship', 'milestone')
    );
END $$;

COMMENT ON COLUMN public.events.anchor_origin IS
  'What the anchor date commemorates: wedding · relationship · milestone. '
  'TYPED OPTIONS ONLY, never free text. ''matters'' (a catch-all "a date that '
  'matters to us") was RETIRED 2026-08-15 per the 2026-07-12 flow-check ruling: '
  'combined with a repeat cadence and the anniversary reminder it reconstitutes '
  'the death-anniversary tracker retired 2026-05-16. Zero rows used it. '
  'Do not re-add it — the guardrail has to be the absence of the option.';
