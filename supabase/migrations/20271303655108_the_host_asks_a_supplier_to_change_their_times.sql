-- the_host_asks_a_supplier_to_change_their_times
-- ============================================================================
-- 🗓 THE HOST — OR THE COORDINATOR — ASKS A BOOKED SUPPLIER TO CHANGE THEIR
-- TIMES ON A MOMENT; THE SUPPLIER ANSWERS YES OR NO.
--
-- Owner, verbatim (2026-11-02, DECISION_LOG "A SUPPLIER'S SCHEDULE BASICS FOR
-- THIS WEEK", item 2): *"receive requests for schedules from hosts of the event
-- and coordinator?"* — the supplier RECEIVES schedule requests from the hosts
-- AND the coordinator, and answers them. Supplier gate audit 2026-11-02, row D2.
--
-- ── ONE FACT, ONE HOME (Rule 8) ──────────────────────────────────────────────
-- Not a new table. `event_schedule_suggestions` (20261130003000 · 20271263061583
-- · 20271300619930) already IS "a proposed change to a moment, waiting on a yes
-- from the other side" — it ran one way only (supplier → host). It now runs
-- both ways, told apart by ONE column:
--
--   direction    'to_host'     (every existing row, the default) — a supplier
--                               asks; the host or coordinator answers.
--                'to_supplier' (new) — a host or coordinator asks; the
--                               supplier answers.
--   asked_as     'host' | 'coordinator' on a 'to_supplier' row only: the
--                coordinator asks AS the coordinator, never as a host. Checked
--                against who the asker really is (the INSERT policy below).
--   answer_note  the supplier's reason on a No (shown to the asker).
--
-- The asker is `suggested_by_user_id` (the row's writer — already NOT NULL) and
-- their name `suggested_by_name`; `vendor_profile_id` is the supplier ASKED.
--
-- ── WHO MAY DO WHAT ─────────────────────────────────────────────────────────
--   · ASK: the couple (asked_as 'host') or a seat holding The Day = Edit
--     (asked_as 'coordinator') — the same two the shipped Approve admits — and
--     only of a supplier BOOKED on this event (the booked set
--     `current_vendor_booked_event_ids` reads, so the supplier can see the
--     moment they are asked about), on a moment of this event, with a new time.
--     `schedule_asks_host_insert`.
--   · A SUPPLIER CANNOT WRITE A 'to_supplier' ROW: a RESTRICTIVE policy
--     (`schedule_asks_only_hosts_ask_suppliers`) holds every INSERT to
--     direction 'to_host' unless the writer may ask. Without it the supplier's
--     own permissive INSERT policy would let them ask THEMSELVES — and then
--     answer Yes, moving the host's schedule.
--   · THE HOST CANNOT ANSWER THEIR OWN ASK: the shipped resolve policy
--     (`schedule_suggestions_couple_resolve`) is now 'to_host' rows only.
--   · ANSWER: only the asked supplier's org, while still booked, while it is
--     open — `may_answer_schedule_ask` (read by the app before the ONE accept
--     path, `lib/schedule-suggestion-decide.server.ts`, applies a Yes).
--   · One open ask per moment per supplier (a partial unique index).
--
-- 🔒 apps/web/tests/db/the-host-asks-a-supplier-to-change-their-times.db.test.ts
-- ============================================================================

-- 1 · The columns ------------------------------------------------------------
ALTER TABLE public.event_schedule_suggestions
  ADD COLUMN IF NOT EXISTS direction   TEXT NOT NULL DEFAULT 'to_host',
  ADD COLUMN IF NOT EXISTS asked_as    TEXT,
  ADD COLUMN IF NOT EXISTS answer_note TEXT;

ALTER TABLE public.event_schedule_suggestions
  DROP CONSTRAINT IF EXISTS event_schedule_suggestions_direction_check;
ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_direction_check
  CHECK (direction IN ('to_host', 'to_supplier'));

-- asked_as is set exactly when the ask runs to the supplier.
ALTER TABLE public.event_schedule_suggestions
  DROP CONSTRAINT IF EXISTS event_schedule_suggestions_asked_as_check;
ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_asked_as_check
  CHECK (
    (asked_as IS NULL OR asked_as IN ('host', 'coordinator'))
    AND ((direction = 'to_supplier') = (asked_as IS NOT NULL))
  );

-- A reason belongs to an answer, never to a request still waiting.
ALTER TABLE public.event_schedule_suggestions
  DROP CONSTRAINT IF EXISTS event_schedule_suggestions_answer_note_check;
ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_answer_note_check
  CHECK (answer_note IS NULL OR (status <> 'open' AND char_length(answer_note) BETWEEN 1 AND 500));

CREATE UNIQUE INDEX IF NOT EXISTS event_schedule_suggestions_one_open_ask
  ON public.event_schedule_suggestions (block_id, vendor_profile_id)
  WHERE direction = 'to_supplier' AND status = 'open';

-- 2 · Who may ask ------------------------------------------------------------
-- The asker really is what `asked_as` says, on this event — and the supplier asked is BOOKED on it (the set that lets
-- them see the moment, `current_vendor_booked_event_ids`). SECURITY DEFINER because a coordinator may hold The Day =
-- Edit with Suppliers Off, so cannot read `event_vendors` themselves; it answers only a caller who may ask on that
-- event, so it is no oracle on who is booked where.
CREATE OR REPLACE FUNCTION public.current_user_may_ask_supplier(p_event_id UUID, p_asked_as TEXT, p_vendor_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    CASE p_asked_as
      WHEN 'host' THEN p_event_id IN (SELECT public.current_couple_event_ids())
      WHEN 'coordinator' THEN EXISTS (
        SELECT 1 FROM public.current_moderator_area_levels('schedule') l(event_id, level)
         WHERE l.event_id = p_event_id AND l.level = 'edit'
      )
      ELSE FALSE
    END
  ) AND EXISTS (
    SELECT 1 FROM public.event_vendors ev
     WHERE ev.event_id = p_event_id
       AND ev.marketplace_vendor_id = p_vendor_profile_id
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
  );
$$;
REVOKE ALL ON FUNCTION public.current_user_may_ask_supplier(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_may_ask_supplier(UUID, TEXT, UUID) TO authenticated;
COMMENT ON FUNCTION public.current_user_may_ask_supplier(UUID, TEXT, UUID) IS
  'A host (the couple) or a seat holding The Day = Edit may ask a supplier BOOKED on the event to change their times (D2, owner 2026-11-02). asked_as must say which.';

DROP POLICY IF EXISTS schedule_asks_host_insert ON public.event_schedule_suggestions;
CREATE POLICY schedule_asks_host_insert
  ON public.event_schedule_suggestions FOR INSERT TO authenticated
  WITH CHECK (
    direction = 'to_supplier'
    AND suggested_by_user_id = (SELECT auth.uid())
    AND status = 'open'
    AND auto_agreed = FALSE
    AND answer_note IS NULL
    AND kind = 'adjust'
    AND proposed_start_at IS NOT NULL
    AND proposed_parent_block_id IS NULL
    AND proposed_crew IS NULL
    AND public.current_user_may_ask_supplier(event_id, asked_as, vendor_profile_id)
    -- a moment of THIS event
    AND EXISTS (
      SELECT 1 FROM public.event_schedule_blocks b
       WHERE b.block_id = event_schedule_suggestions.block_id
         AND b.event_id = event_schedule_suggestions.event_id
    )
  );

-- Every INSERT runs to the host, unless the writer may ask (a supplier can never ask itself).
DROP POLICY IF EXISTS schedule_asks_only_hosts_ask_suppliers ON public.event_schedule_suggestions;
CREATE POLICY schedule_asks_only_hosts_ask_suppliers
  ON public.event_schedule_suggestions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    direction = 'to_host'
    OR public.current_user_may_ask_supplier(event_id, asked_as, vendor_profile_id)
  );

-- 3 · The host answers only what a SUPPLIER asked ------------------------------
-- The shipped policy (20261130003000, in the once-per-query form of 20271281556823), plus `direction = 'to_host'`.
DROP POLICY IF EXISTS schedule_suggestions_couple_resolve ON public.event_schedule_suggestions;
CREATE POLICY schedule_suggestions_couple_resolve
  ON public.event_schedule_suggestions FOR UPDATE TO authenticated
  USING (
    direction = 'to_host'
    AND (
      event_id IN (SELECT public.current_couple_event_ids())
      OR event_id IN (
        SELECT l.event_id FROM public.current_moderator_area_levels('schedule') l(event_id, level) WHERE l.level = 'edit'
      )
    )
  )
  WITH CHECK (
    direction = 'to_host'
    AND (
      event_id IN (SELECT public.current_couple_event_ids())
      OR event_id IN (
        SELECT l.event_id FROM public.current_moderator_area_levels('schedule') l(event_id, level) WHERE l.level = 'edit'
      )
    )
  );

-- 4 · The supplier answers only what it was asked ------------------------------
-- Read by the app before the ONE accept path applies a Yes (or writes a No) with the service role. The status flip is
-- that path's, after the schedule changed — so a refused write never reads 'accepted' over an unchanged moment.
CREATE OR REPLACE FUNCTION public.may_answer_schedule_ask(p_suggestion_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.event_schedule_suggestions s
     WHERE s.suggestion_id = p_suggestion_id
       AND s.direction = 'to_supplier'
       AND s.status = 'open'
       AND s.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
       AND s.event_id IN (SELECT public.current_vendor_booked_event_ids())
  );
$$;
REVOKE ALL ON FUNCTION public.may_answer_schedule_ask(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.may_answer_schedule_ask(UUID) TO authenticated;
COMMENT ON FUNCTION public.may_answer_schedule_ask(UUID) IS
  'True when the caller''s supplier org was asked (direction to_supplier), is still booked on the event, and the ask is open (D2, owner 2026-11-02).';

COMMENT ON COLUMN public.event_schedule_suggestions.direction IS
  'to_host = a supplier asks, the host or coordinator answers; to_supplier = a host or coordinator asks a booked supplier to change their times, the supplier answers (D2, 2026-11-02).';
COMMENT ON COLUMN public.event_schedule_suggestions.asked_as IS
  'On a to_supplier ask: host or coordinator — who the asker is on this event (checked by current_user_may_ask_supplier).';
COMMENT ON COLUMN public.event_schedule_suggestions.answer_note IS
  'The supplier''s reason on a No to a to_supplier ask, shown to the asker.';
