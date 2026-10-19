-- a_claimed_supplier_asks_for_access
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS, DROP/CREATE
-- for constraints, indexes and policies, CREATE OR REPLACE for functions).
-- ============================================================================
-- A SUPPLIER WHO CLAIMS THE COUPLE'S LINK ASKS FOR ACCESS ON ITS OWN, AND IS
-- LET IN ONLY WHEN THE COUPLE APPROVES.
--
-- Owner, 2026-10-20 (DECISION_LOG "A CLAIMED SUPPLIER ARRIVES BOOKED IF PAID,
-- ASKS FOR ACCESS ON ITS OWN…"): *"access to the event is automatic but has an
-- approval. it should proceed to that approval giving access once they sync."*
--
-- 🔑 WHAT "ACCESS" IS, MEASURED. Every supplier-side read of a couple's event —
-- the brief, the seat plan, the mood board, the booked-supplier schedule read,
-- and ~80 other functions — finds the supplier through ONE column:
-- `event_vendors.marketplace_vendor_id`. Until now the claim wrote that column
-- the moment the supplier signed up (`claim_link_record_to_shop`), so a record
-- the couple had marked booked handed its category's access over before anyone
-- had approved anything. Holding the BOND until the approval holds every one of
-- those reads at once; holding any narrower thing would leave the rest open.
--
--   1. `event_access_requests` (the shipped approval, 20271014200000) gains a
--      second kind: 'claim' — "this shop joined from your link; let them in?".
--      It names the couple's record (`event_vendor_id`). A supplier can still
--      only INSERT the shipped kind ('areas'); a 'claim' row is written by the
--      server on the claim, never by a browser.
--   2. `claim_ask_for_access` — raised by the claim (service role). One pending
--      ask per record; a retry returns the same ask.
--   3. `answer_claim_access_request` — the couple's Approve / Decline (service
--      role, called by the server action after it has proved the caller is the
--      couple, and re-checked here). APPROVE, in one transaction:
--        a. a record the couple added by hand that has a recorded payment is
--           BOOKED (owner: "if the manual input has payment already, it is
--           technically booked already") — its stored status catches up to
--           'contracted' here, so the server's booked-supplier reads serve its
--           category's access. Written while the row is still the couple's own
--           record (no shop yet), the way a hand booking is written;
--        b. the bond: `claim_link_record_to_shop` (links, or merges onto the
--           shop's existing row on this event);
--        c. the shipped sibling pass (best-effort, not after a merge);
--        d. a coordinator (the coordinator trade, `services_make_a_coordinator`)
--           gets a host-level seat — the permissions the app passes in are
--           `COORDINATOR_AREAS` (lib/delegate-areas.ts), the grant every
--           coordinator seat is created with (DECISION_LOG 2026-10-07);
--        e. the ask is answered {"access":"granted"} and points at the row that
--           now carries the booking.
--      DECLINE answers {"access":"declined"} and writes nothing else.
--   4. `claim_link_record_to_shop` re-created from its only body
--      (20271268139017) with ONE addition: a merge re-points the schedule's
--      `responsible_vendor_ids` (a uuid[], so the FK loop could never see it) —
--      the items the couple gave to their record follow the booking.
-- ============================================================================

BEGIN;

-- ── 1 · the ask gains a kind ───────────────────────────────────────────────
ALTER TABLE public.event_access_requests
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'areas';
ALTER TABLE public.event_access_requests
  ADD COLUMN IF NOT EXISTS event_vendor_id UUID
    REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE;

ALTER TABLE public.event_access_requests
  DROP CONSTRAINT IF EXISTS event_access_requests_kind_check;
ALTER TABLE public.event_access_requests
  ADD CONSTRAINT event_access_requests_kind_check CHECK (kind IN ('areas', 'claim'));

-- A claim names the couple's record; an areas ask never does.
ALTER TABLE public.event_access_requests
  DROP CONSTRAINT IF EXISTS event_access_requests_claim_names_a_record;
ALTER TABLE public.event_access_requests
  ADD CONSTRAINT event_access_requests_claim_names_a_record
    CHECK ((kind = 'claim') = (event_vendor_id IS NOT NULL));

-- The areas rule stays exactly as shipped for 'areas'; a claim asks for no
-- named area (what it opens is decided by the supplier's category).
ALTER TABLE public.event_access_requests
  DROP CONSTRAINT IF EXISTS event_access_requests_requested_areas_check;
ALTER TABLE public.event_access_requests
  ADD CONSTRAINT event_access_requests_requested_areas_check CHECK (
    (
      kind = 'areas'
      AND cardinality(requested_areas) BETWEEN 1 AND 7
      AND requested_areas <@ ARRAY[
        'guest_list', 'seat_plan', 'schedule', 'vendors',
        'invitations', 'mood_board', 'budget'
      ]::TEXT[]
    )
    OR (kind = 'claim' AND cardinality(requested_areas) = 0)
  );

-- One pending AREAS ask per person per event (as shipped) — a pending claim
-- must not block the same coordinator asking for an area later, nor the
-- reverse. One pending CLAIM ask per record.
DROP INDEX IF EXISTS public.event_access_requests_one_pending_idx;
CREATE UNIQUE INDEX event_access_requests_one_pending_idx
  ON public.event_access_requests (event_id, requester_user_id)
  WHERE status = 'pending' AND kind = 'areas';

CREATE UNIQUE INDEX IF NOT EXISTS event_access_requests_one_pending_claim_idx
  ON public.event_access_requests (event_vendor_id)
  WHERE status = 'pending' AND kind = 'claim';

COMMENT ON COLUMN public.event_access_requests.kind IS
  '''areas'' = a booked coordinator asking for named areas (2026-07-27). ''claim'' = a supplier who joined from the '
  'couple''s link, waiting to be let in (2026-10-20); written only by claim_ask_for_access, answered only by '
  'answer_claim_access_request.';
COMMENT ON COLUMN public.event_access_requests.event_vendor_id IS
  'For a claim: the couple''s record the supplier joined through (pointed at the row that carries the booking once approved).';

-- A supplier's own INSERT stays the shipped kind. Re-created from its only body
-- (20271014200000) with the kind pinned, so no browser can raise a claim.
DROP POLICY IF EXISTS event_access_requests_own_insert ON public.event_access_requests;
CREATE POLICY event_access_requests_own_insert
  ON public.event_access_requests FOR INSERT TO authenticated
  WITH CHECK (
    requester_user_id = auth.uid()
    AND kind = 'areas'
    AND event_vendor_id IS NULL
    AND event_id IN (SELECT public.current_vendor_booked_event_ids())
  );

-- ── 4 · the merge-aware link, now carrying the schedule's tags ─────────────
CREATE OR REPLACE FUNCTION public.claim_link_record_to_shop(
  p_record_vendor_id UUID,
  p_vendor_profile_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec      RECORD;
  v_survivor RECORD;
  v_fk       RECORD;
BEGIN
  SELECT vendor_id, event_id, manual_vendor_id, marketplace_vendor_id,
         total_cost_php, host_inclusions, covers_plan_groups
    INTO v_rec
    FROM public.event_vendors
   WHERE vendor_id = p_record_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_link_record_to_shop: record % not found', p_record_vendor_id;
  END IF;
  -- The re-point guard of the shipped claim: a record already bonded to a
  -- DIFFERENT shop is never taken over.
  IF v_rec.marketplace_vendor_id IS NOT NULL AND v_rec.marketplace_vendor_id <> p_vendor_profile_id THEN
    RAISE EXCEPTION 'claim_link_record_to_shop: record is already linked to another shop';
  END IF;

  SELECT vendor_id, manual_vendor_id, total_cost_php, host_inclusions, covers_plan_groups
    INTO v_survivor
    FROM public.event_vendors
   WHERE event_id = v_rec.event_id
     AND marketplace_vendor_id = p_vendor_profile_id
     AND vendor_id <> p_record_vendor_id
     AND archived_at IS NULL
     AND package_role IS DISTINCT FROM 'covered'
   ORDER BY created_at ASC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.event_vendors
       SET marketplace_vendor_id = p_vendor_profile_id
     WHERE vendor_id = p_record_vendor_id;
    RETURN p_record_vendor_id;
  END IF;

  -- ── MERGE onto the survivor ──────────────────────────────────────────────
  UPDATE public.event_vendors s
     SET manual_vendor_id   = COALESCE(s.manual_vendor_id, v_rec.manual_vendor_id),
         total_cost_php     = COALESCE(s.total_cost_php, v_rec.total_cost_php),
         host_inclusions    = CASE
                                WHEN cardinality(s.host_inclusions) = 0 THEN v_rec.host_inclusions
                                ELSE s.host_inclusions
                              END,
         covers_plan_groups = CASE
                                WHEN cardinality(s.covers_plan_groups) = 0
                                THEN v_rec.covers_plan_groups
                                ELSE s.covers_plan_groups
                              END
   WHERE s.vendor_id = v_survivor.vendor_id;

  -- Every single-column foreign key that points at event_vendors(vendor_id):
  -- what hung off the record now hangs off the survivor. One table at a time,
  -- so a refusal leaves that table's rows on the (archived) record.
  FOR v_fk IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f'
       AND c.confrelid = 'public.event_vendors'::regclass
       AND c.conrelid <> 'public.event_vendors'::regclass
       AND cardinality(c.conkey) = 1
  LOOP
    BEGIN
      EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', v_fk.tbl, v_fk.col, v_fk.col)
        USING v_survivor.vendor_id, p_record_vendor_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'claim_link_record_to_shop: % stayed on the record (%)', v_fk.tbl, SQLERRM;
    END;
  END LOOP;

  -- 🗓 NEW (2026-10-20). The schedule's "given to this supplier" tags are a
  -- uuid[] of event_vendors ids with NO foreign key, so the loop above never saw
  -- them: after a merge every item the couple had given their record stayed on
  -- the archived record — out of the supplier's view and out of the survivor's
  -- lens. They follow the booking now; a block already tagged with the survivor
  -- just loses the duplicate.
  UPDATE public.event_schedule_blocks b
     SET responsible_vendor_ids = CASE
           WHEN v_survivor.vendor_id = ANY (b.responsible_vendor_ids)
             THEN array_remove(b.responsible_vendor_ids, p_record_vendor_id)
           ELSE array_replace(b.responsible_vendor_ids, p_record_vendor_id, v_survivor.vendor_id)
         END
   WHERE b.event_id = v_rec.event_id
     AND p_record_vendor_id = ANY (b.responsible_vendor_ids);

  UPDATE public.event_vendors
     SET archived_at = COALESCE(archived_at, now())
   WHERE vendor_id = p_record_vendor_id;

  RETURN v_survivor.vendor_id;
END;
$$;

COMMENT ON FUNCTION public.claim_link_record_to_shop(UUID, UUID) IS
  'Links a couple''s hand-typed record to the shop that claimed its link. If the shop already has a live row on the event '
  '(a save from Find), the record MERGES onto that row (its contact card, price/inclusions/covers where the row has none, '
  'every row pointing at it, and the schedule items tagged to it) and is archived — the survivor keeps the earliest '
  'sourced fact. Status never moves. Returns the vendor_id that now carries the booking. Service role only — since '
  '2026-10-20 it runs from answer_claim_access_request, on the couple''s approval.';

REVOKE ALL ON FUNCTION public.claim_link_record_to_shop(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_link_record_to_shop(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.claim_link_record_to_shop(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_link_record_to_shop(UUID, UUID) TO service_role;

-- ── 2 · the claim raises the ask ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_ask_for_access(
  p_record_vendor_id UUID,
  p_vendor_profile_id UUID,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_bonded   UUID;
  v_id       UUID;
BEGIN
  SELECT event_id, marketplace_vendor_id INTO v_event_id, v_bonded
    FROM public.event_vendors
   WHERE vendor_id = p_record_vendor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_ask_for_access: record % not found', p_record_vendor_id USING ERRCODE = 'P0002';
  END IF;
  IF v_bonded IS NOT NULL AND v_bonded <> p_vendor_profile_id THEN
    RAISE EXCEPTION 'claim_ask_for_access: record is already linked to another shop' USING ERRCODE = '42501';
  END IF;

  SELECT request_id INTO v_id
    FROM public.event_access_requests
   WHERE event_vendor_id = p_record_vendor_id AND kind = 'claim' AND status = 'pending';
  IF FOUND THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.event_access_requests
    (event_id, requester_user_id, vendor_profile_id, requested_areas, kind, event_vendor_id)
  VALUES
    (v_event_id, p_user_id, p_vendor_profile_id, ARRAY[]::TEXT[], 'claim', p_record_vendor_id)
  RETURNING request_id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.claim_ask_for_access(UUID, UUID, UUID) IS
  'The claim''s one write toward access: a pending ''claim'' ask for the couple''s record. Grants nothing. Idempotent per '
  'record. Service role only (the claim runs on the admin client).';

REVOKE ALL ON FUNCTION public.claim_ask_for_access(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ask_for_access(UUID, UUID, UUID) TO service_role;

-- ── 3 · the couple's answer ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.answer_claim_access_request(
  p_request_id UUID,
  p_decided_by UUID,
  p_approve BOOLEAN,
  p_coordinator_permissions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req         RECORD;
  v_rec         RECORD;
  v_booking     UUID;
  v_booked      BOOLEAN := FALSE;
  v_coordinator BOOLEAN := FALSE;
BEGIN
  SELECT request_id, event_id, requester_user_id, vendor_profile_id, event_vendor_id, kind, status
    INTO v_req
    FROM public.event_access_requests
   WHERE request_id = p_request_id
   FOR UPDATE;
  IF NOT FOUND OR v_req.kind <> 'claim' THEN
    RAISE EXCEPTION 'answer_claim_access_request: no such ask' USING ERRCODE = 'P0002';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'answer_claim_access_request: already answered' USING ERRCODE = '55000';
  END IF;
  -- The couple answers — not a helper, not a coordinator (who could let
  -- themselves in), not the supplier.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_members m
     WHERE m.event_id = v_req.event_id AND m.user_id = p_decided_by AND m.member_type = 'couple'
  ) THEN
    RAISE EXCEPTION 'answer_claim_access_request: only the couple answers' USING ERRCODE = '42501';
  END IF;
  -- The ask must be backed by a real claim of THIS record by THIS person and
  -- shop. The couple may UPDATE ask rows under RLS, so the row alone is not
  -- proof of anything.
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_invites i
     WHERE i.vendor_id = v_req.event_vendor_id
       AND i.status = 'claimed'
       AND i.claimed_vendor_profile_id = v_req.vendor_profile_id
       AND i.claimed_by_user_id = v_req.requester_user_id
  ) THEN
    RAISE EXCEPTION 'answer_claim_access_request: no claim stands behind this ask' USING ERRCODE = '42501';
  END IF;

  IF NOT p_approve THEN
    UPDATE public.event_access_requests
       SET status = 'answered',
           decisions = jsonb_build_object('access', 'declined'),
           decided_by_user_id = p_decided_by
     WHERE request_id = p_request_id;
    RETURN jsonb_build_object('granted', FALSE);
  END IF;

  SELECT vendor_id, event_id, category::TEXT AS category, status::TEXT AS status,
         marketplace_vendor_id, manual_vendor_id
    INTO v_rec
    FROM public.event_vendors
   WHERE vendor_id = v_req.event_vendor_id
   FOR UPDATE;

  -- a · booked if paid. Hand-added (no shop yet), not booked, and at least one
  -- payment the supplier has not refused → it IS booked. Its own sub-block: a
  -- guard that refuses the status leaves the approval standing (the couple's
  -- screens read Booked from the payment either way — lib/booked-by-payment.ts).
  IF v_rec.marketplace_vendor_id IS NULL
     AND v_rec.status IN ('considering', 'shortlisted')
     AND EXISTS (
       SELECT 1 FROM public.event_vendor_payments p
        WHERE p.vendor_id = v_rec.vendor_id AND p.payment_refused_at IS NULL
     )
  THEN
    BEGIN
      UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = v_rec.vendor_id;
      v_booked := TRUE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'answer_claim_access_request: status stayed % (%)', v_rec.status, SQLERRM;
    END;
  ELSIF v_rec.status IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    v_booked := TRUE;
  END IF;

  -- b · the bond (or the merge onto the shop's existing row).
  v_booking := public.claim_link_record_to_shop(v_rec.vendor_id, v_req.vendor_profile_id);

  -- c · the shipped sibling pass: the couple's other categories for the same
  -- hand-added supplier. Best-effort, as it always was; never after a merge.
  IF v_booking = v_rec.vendor_id AND v_rec.manual_vendor_id IS NOT NULL THEN
    BEGIN
      UPDATE public.event_vendors
         SET marketplace_vendor_id = v_req.vendor_profile_id
       WHERE manual_vendor_id = v_rec.manual_vendor_id
         AND event_id = v_rec.event_id
         AND vendor_id <> v_rec.vendor_id
         AND (marketplace_vendor_id IS NULL OR marketplace_vendor_id = v_req.vendor_profile_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'answer_claim_access_request: siblings stayed unlinked (%)', SQLERRM;
    END;
  END IF;

  -- d · a coordinator gets the host-level seat (DECISION_LOG 2026-10-07:
  -- "Coordinator Access is Same as User Host… Always auto YES"). A live seat
  -- the couple already shaped keeps its areas.
  IF public.services_make_a_coordinator(ARRAY[v_rec.category]) THEN
    v_coordinator := TRUE;
    INSERT INTO public.event_moderators
      (event_id, user_id, role_subtype, permissions_json, invited_by_user_id, accepted_at)
    VALUES
      (v_rec.event_id, v_req.requester_user_id, 'wedding_planner_external',
       COALESCE(p_coordinator_permissions, '{}'::jsonb), p_decided_by, now())
    ON CONFLICT (event_id, user_id) DO UPDATE
      SET permissions_json = CASE
                               WHEN public.event_moderators.removed_at IS NOT NULL
                                 THEN EXCLUDED.permissions_json
                               ELSE public.event_moderators.permissions_json
                             END,
          role_subtype     = CASE
                               WHEN public.event_moderators.removed_at IS NOT NULL
                                 THEN EXCLUDED.role_subtype
                               ELSE public.event_moderators.role_subtype
                             END,
          accepted_at      = COALESCE(public.event_moderators.accepted_at, now()),
          removed_at       = NULL;
  END IF;

  -- e · the record of what was asked and what was said.
  UPDATE public.event_access_requests
     SET status = 'answered',
         decisions = jsonb_build_object('access', 'granted'),
         decided_by_user_id = p_decided_by,
         event_vendor_id = v_booking
   WHERE request_id = p_request_id;

  RETURN jsonb_build_object(
    'granted', TRUE,
    'booking_vendor_id', v_booking,
    'merged', v_booking <> v_rec.vendor_id,
    'booked', v_booked,
    'coordinator', v_coordinator
  );
END;
$$;

COMMENT ON FUNCTION public.answer_claim_access_request(UUID, UUID, BOOLEAN, JSONB) IS
  'The couple''s Approve / Decline on a supplier who joined from their link (owner 2026-10-20). Approve = booked-if-paid '
  'catch-up, the bond/merge (claim_link_record_to_shop), the sibling pass, a host-level seat for a coordinator. '
  'Decline writes only the answer. Nothing is granted before this runs. Service role only — the server action proves '
  'the caller is the couple first, and this re-checks it.';

REVOKE ALL ON FUNCTION public.answer_claim_access_request(UUID, UUID, BOOLEAN, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.answer_claim_access_request(UUID, UUID, BOOLEAN, JSONB) TO service_role;

COMMIT;
