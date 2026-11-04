-- supplier_writes_their_part_of_the_schedule
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 🤝 SCHEDULE AND CHAPTERS — STEP 4b: THE SUPPLIER'S PART OF THE SCHEDULE (owner 2026-11-01, DECISION_LOG "SUPPLIERS
-- GIVE THEIR PART FROM THEIR SCHEDULE VIEW" · "SCHEDULE PLAN §9: EIGHT OPEN ITEMS RULED" (4: Auto-agree starts Off) ·
-- "THE BLOW BY BLOW FROM THE REAL RUN OF SHOW"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §3, §3c, §7, §12 Step 4).
--
-- Owner, verbatim: *"so this is where suppliers can add their schedule and blow by blow as well? that is their part to
-- give to the event."* · *"yes correct. they still approve or decline"* (3 Oct, unchanged).
--
-- 🔑 EXTEND, DO NOT REBUILD (plan §7). A supplier's add · edit · delete · times are still ROWS in
-- `event_schedule_suggestions` (20261130003000, widened by 20271263061583) that the host or coordinator approves —
-- suppliers never write `event_schedule_blocks` or `event_schedule_tasks`. This file adds only what the plan names as
-- still needed: "the section, length and crew on a request" — and the four things the supplier's view asks for.
--
-- ── 1 · AUTO-AGREE (3 Oct; ruled 1 Nov: STARTS OFF) — `events.supplier_requests_auto_agree` ───────────────────────────
-- ONE setting per event: "I check and approve / reject" (false, the default for every event, new and old) or
-- "Auto-agree" (true: a supplier's change goes straight in). Written by the couple under the events row's own RLS.
-- Nothing in the database applies a request by itself: the app's ONE accept path (`lib/schedule-suggestion-decide.server.ts`)
-- runs either way, and reads this column first. Off = the request WAITS (held by
-- `lib/auto-agree-off-means-the-change-waits.test.ts`).
--
-- ── 2 · A NEW MOMENT NAMES ITS CHAPTER; A REQUEST CARRIES ITS CREW ───────────────────────────────────────────────────
--   proposed_parent_block_id — "+ My moment" asks for a moment INSIDE a chapter (a moment is a child block, 20271300072429).
--                              Only a chapter the supplier is LINKED to (plan §3: "only the chapters they're linked to"):
--                              its `responsible_vendor_ids` holds one of their bookings — the same column Where writes
--                              (#7156) and the own-items test reads (`current_vendor_owns_schedule_block`). SET NULL on
--                              delete: the request outlives a chapter the host removed, as it outlives its block.
--   proposed_crew            — "Who on our side" (§3c #5: *"Jubert Team A bride · Team B groom"*): the crew names on the
--                              supplier's moment. On approval each becomes an `event_schedule_tasks` row (vendor_id = their
--                              booking, crew = the name) — the crew-on-a-task shape 20271300072429 chose. NULL = unchanged.
--   Length is `proposed_end_at` (start + minutes). Section (Ingress · Event · Egress) is READ FROM THE TIME, never stored
--   (`momentSection`, lib/schedule-chapters.ts), so a request needs no column for it.
--   auto_agreed              — true when Auto-agree applied it (no person decided). The host's history can say so.
--
-- ── 3 · TAKE BACK — status 'withdrawn' + `withdraw_schedule_request` ─────────────────────────────────────────────────
-- "Waiting for the host" with Take back (plan §3). Only the supplier org that asked, only while it is still open. A
-- SECURITY DEFINER function, not an UPDATE policy: a policy would let the same request rewrite its proposal on the way
-- out; the function flips the status and nothing else.
--
-- ── 4 · SEEN AND CONFIRM MY TIMES — `event_supplier_schedule_marks` + `supplier_mark_schedule` ───────────────────────
-- `Seen` on a change, and a final-week `Confirm my times` (plan §3). One row per supplier org per event. Not columns on
-- `event_vendors`: that row carries a dozen BEFORE/AFTER UPDATE triggers (the delegate audit, the free-tier cap, the
-- lock and deposit guards) that a supplier's "Seen" must not fire, and a supplier has no read on it at all.
-- Written ONLY through `supplier_mark_schedule` (booked on the event, own org); CONFIRM only in the final week — the
-- seven days up to and including the event day, on the Manila calendar. Read by the supplier (own rows) and the couple
-- and a helper with any Schedule level (who has seen, who confirmed).
--
-- Held by apps/web/tests/db/the-supplier-writes-their-part.db.test.ts (a supplier cannot edit or add into what isn't
-- theirs · Take back only their own · Confirm is recorded, and only in the final week).

BEGIN;

-- ── 1 · Auto-agree ──────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS supplier_requests_auto_agree BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.events.supplier_requests_auto_agree IS
  'Supplier requests on the schedule: false = "I check and approve / reject" (the default, ruled 1 Nov) · true = '
  '"Auto-agree" (a supplier''s change goes straight in). Read by the app''s one accept path. 20271300619930.';

-- `events` SELECT is a column allowlist (20271007100000): a new column is born unreadable to `authenticated`, so the
-- host's Event access row can read it. NO UPDATE grant — the host's choice is written by `setSupplierAutoAgree` on the
-- service role after its host check (the shape of `same_date_count_opt_out`, 20271285020592).
GRANT SELECT (supplier_requests_auto_agree) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANT), so the block below is reproduced
-- VERBATIM from 20271285020592 (the latest carrier of it) — extracted mechanically, not retyped — including its
-- private list and its refuse-if-empty guard.

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

REVOKE ALL ON public.events_host FROM PUBLIC;
REVOKE ALL ON public.events_host FROM anon;
REVOKE ALL ON public.events_host FROM authenticated;
GRANT SELECT ON public.events_host TO authenticated, service_role;

COMMENT ON VIEW public.events_host IS
  'Couple/moderator-scoped read path for events, including the columns denied to authenticated on the base table (20271008731642 + 20271025120000: birth data, budget, wizard_state, Drive folder, AI tier, signature_details, honoree_label, honoree_dependent_id). Guests, vendors and coordinators get ZERO rows. security_invoker=false by design.';

-- ── 2 · the request's new fields ────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.event_schedule_suggestions
  ADD COLUMN IF NOT EXISTS proposed_parent_block_id UUID,
  ADD COLUMN IF NOT EXISTS proposed_crew            TEXT[],
  ADD COLUMN IF NOT EXISTS auto_agreed              BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.event_schedule_suggestions
  DROP CONSTRAINT IF EXISTS event_schedule_suggestions_proposed_parent_block_id_fkey;
ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_proposed_parent_block_id_fkey
  FOREIGN KEY (proposed_parent_block_id) REFERENCES public.event_schedule_blocks(block_id) ON DELETE SET NULL;

-- A crew name is what `event_schedule_tasks.crew` accepts (1–60 characters), at most twelve on one request.
CREATE OR REPLACE FUNCTION public.schedule_crew_names_ok(p_names TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_names IS NULL
      OR (cardinality(p_names) BETWEEN 1 AND 12
          AND NOT EXISTS (SELECT 1 FROM unnest(p_names) n WHERE n IS NULL OR char_length(btrim(n)) NOT BETWEEN 1 AND 60));
$$;

ALTER TABLE public.event_schedule_suggestions
  DROP CONSTRAINT IF EXISTS event_schedule_suggestions_crew_check;
ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_crew_check CHECK (public.schedule_crew_names_ok(proposed_crew));

-- Only an add names a chapter (an edit or a delete is about a moment that already has one).
ALTER TABLE public.event_schedule_suggestions
  DROP CONSTRAINT IF EXISTS event_schedule_suggestions_parent_only_on_new;
ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_parent_only_on_new
  CHECK (proposed_parent_block_id IS NULL OR kind = 'new');

-- The status vocabulary gains 'withdrawn' (Take back). Drop every CHECK that speaks of `status` by what it says — the
-- inline one from 20261130003000 — whatever Postgres named it.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
     WHERE con.conrelid = 'public.event_schedule_suggestions'::regclass
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.event_schedule_suggestions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_status_check
  CHECK (status IN ('open', 'accepted', 'declined', 'withdrawn'));

-- ── 2b · the INSERT policy: the own-items rule of 20271263061583, kept word for word (in the once-per-query form of
--        20271281556823), plus the chapter rule and the crew rule ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS schedule_suggestions_vendor_insert ON public.event_schedule_suggestions;
CREATE POLICY schedule_suggestions_vendor_insert
  ON public.event_schedule_suggestions FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND suggested_by_user_id = (SELECT auth.uid())
    AND status = 'open'
    AND auto_agreed = FALSE
    -- an add names no block; a change or a removal names exactly one…
    AND (kind = 'new') = (block_id IS NULL)
    -- …on this event
    AND (
      block_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.event_schedule_blocks b
         WHERE b.block_id = event_schedule_suggestions.block_id
           AND b.event_id = event_schedule_suggestions.event_id
      )
    )
    -- + My moment: only into a chapter of THIS event that the supplier is linked to
    AND (
      proposed_parent_block_id IS NULL
      OR (
        EXISTS (
          SELECT 1 FROM public.event_schedule_blocks c
           WHERE c.block_id = event_schedule_suggestions.proposed_parent_block_id
             AND c.event_id = event_schedule_suggestions.event_id
             AND c.parent_block_id IS NULL
        )
        AND public.current_vendor_owns_schedule_block(proposed_parent_block_id, vendor_profile_id)
      )
    )
    AND (
      kind = 'new'
      -- a suggestion (words only) may go on anybody's item — words only: no proposed field, no crew
      OR (
        kind = 'adjust'
        AND proposed_label IS NULL
        AND proposed_start_at IS NULL
        AND proposed_end_at IS NULL
        AND proposed_location IS NULL
        AND proposed_crew IS NULL
      )
      -- an edit or a delete only on the supplier's own
      OR public.current_vendor_owns_schedule_block(block_id, vendor_profile_id)
    )
  );

-- ── 3 · Take back ───────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.withdraw_schedule_request(p_suggestion_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  UPDATE public.event_schedule_suggestions s
     SET status      = 'withdrawn',
         resolved_at = NOW()
   WHERE s.suggestion_id = p_suggestion_id
     AND s.status = 'open'
     AND s.vendor_profile_id IN (SELECT public.current_vendor_profile_ids());
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.withdraw_schedule_request(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_schedule_request(UUID) TO authenticated;

COMMENT ON FUNCTION public.withdraw_schedule_request(UUID) IS
  'Take back: the supplier org that asked withdraws its own request while it is still open. Flips the status only. '
  'False = nothing taken back (already decided, or not theirs). 20271300619930.';

-- ── 4 · Seen and Confirm my times ───────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_supplier_schedule_marks (
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The last time this supplier pressed Seen (or Confirm, which sees too).
  seen_at           TIMESTAMPTZ,
  -- The last time this supplier pressed Confirm my times (final week only).
  confirmed_at      TIMESTAMPTZ,
  PRIMARY KEY (event_id, vendor_profile_id)
);

ALTER TABLE public.event_supplier_schedule_marks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS event_supplier_schedule_marks_vendor_idx
  ON public.event_supplier_schedule_marks (vendor_profile_id);

COMMENT ON TABLE public.event_supplier_schedule_marks IS
  'A booked supplier''s Seen (on a schedule change) and Confirm my times (final week), one row per supplier org per '
  'event. Written only by supplier_mark_schedule; read by that supplier and by the couple and Schedule helpers. '
  '20271300619930.';

REVOKE ALL ON TABLE public.event_supplier_schedule_marks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.event_supplier_schedule_marks TO authenticated;
GRANT ALL ON TABLE public.event_supplier_schedule_marks TO service_role;

DROP POLICY IF EXISTS event_supplier_schedule_marks_vendor_read ON public.event_supplier_schedule_marks;
CREATE POLICY event_supplier_schedule_marks_vendor_read
  ON public.event_supplier_schedule_marks FOR SELECT
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS event_supplier_schedule_marks_couple_read ON public.event_supplier_schedule_marks;
CREATE POLICY event_supplier_schedule_marks_couple_read
  ON public.event_supplier_schedule_marks FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_supplier_schedule_marks_moderator_read ON public.event_supplier_schedule_marks;
CREATE POLICY event_supplier_schedule_marks_moderator_read
  ON public.event_supplier_schedule_marks FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('schedule') l WHERE l.level IS NOT NULL));

-- p_mark: 'seen' | 'confirm'. Returns the time written. Refuses (42501) a caller not booked on the event, and (22023) a
-- Confirm outside the final week.
CREATE OR REPLACE FUNCTION public.supplier_mark_schedule(p_event_id UUID, p_mark TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vp    UUID;
  v_day   DATE;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Manila')::date;
  v_now   TIMESTAMPTZ := NOW();
BEGIN
  IF p_mark NOT IN ('seen', 'confirm') THEN
    RAISE EXCEPTION 'Unknown mark.' USING ERRCODE = '22023';
  END IF;
  IF p_event_id IS NULL OR p_event_id NOT IN (SELECT public.current_vendor_booked_event_ids()) THEN
    RAISE EXCEPTION 'Only a supplier booked on this event can do that.' USING ERRCODE = '42501';
  END IF;

  -- The caller's own supplier org on this event (the booked one; owner or team member).
  SELECT ev.marketplace_vendor_id INTO v_vp
    FROM public.event_vendors ev
   WHERE ev.event_id = p_event_id
     AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND ev.marketplace_vendor_id IN (SELECT public.current_vendor_profile_ids())
   ORDER BY ev.created_at
   LIMIT 1;
  IF v_vp IS NULL THEN
    RAISE EXCEPTION 'Only a supplier booked on this event can do that.' USING ERRCODE = '42501';
  END IF;

  IF p_mark = 'confirm' THEN
    SELECT e.event_date INTO v_day FROM public.events e WHERE e.event_id = p_event_id;
    IF v_day IS NULL OR v_today < v_day - 7 OR v_today > v_day THEN
      RAISE EXCEPTION 'Confirm my times opens one week before the event.' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.event_supplier_schedule_marks AS m (event_id, vendor_profile_id, seen_at, confirmed_at)
  VALUES (p_event_id, v_vp, v_now, CASE WHEN p_mark = 'confirm' THEN v_now END)
  ON CONFLICT (event_id, vendor_profile_id) DO UPDATE
     SET seen_at      = v_now,
         confirmed_at = CASE WHEN p_mark = 'confirm' THEN v_now ELSE m.confirmed_at END;

  RETURN v_now;
END;
$$;
REVOKE ALL ON FUNCTION public.supplier_mark_schedule(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_mark_schedule(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.supplier_mark_schedule(UUID, TEXT) IS
  'A booked supplier presses Seen (''seen'') or Confirm my times (''confirm'', the final week only — the seven days up '
  'to the event day, Manila calendar). Writes event_supplier_schedule_marks for the caller''s own org. 20271300619930.';

-- The fence must really be there: RLS on, anon holds nothing, no policy names anon, nobody writes the table directly.
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.event_supplier_schedule_marks'::regclass) THEN
    RAISE EXCEPTION 'event_supplier_schedule_marks must have RLS on';
  END IF;
  IF has_table_privilege('anon', 'public.event_supplier_schedule_marks', 'SELECT') THEN
    RAISE EXCEPTION 'anon must not read event_supplier_schedule_marks';
  END IF;
  IF has_table_privilege('authenticated', 'public.event_supplier_schedule_marks', 'INSERT')
     OR has_table_privilege('authenticated', 'public.event_supplier_schedule_marks', 'UPDATE') THEN
    RAISE EXCEPTION 'event_supplier_schedule_marks is written only through supplier_mark_schedule';
  END IF;
END;
$$;

COMMIT;
