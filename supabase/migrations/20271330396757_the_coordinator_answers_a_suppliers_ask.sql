-- the_coordinator_answers_a_suppliers_ask
-- ============================================================================
-- 🤝 A HOST — OR THE BOOKED COORDINATOR — ANSWERS A SUPPLIER'S ACCESS ASK;
-- A COORDINATOR'S OWN ASK IS THE HOSTS' ALONE (owner rule, 8 Nov 2026:
-- *"each supplier or coordinator can request for access for different parts of
-- the event … only coordinator and hosts has the final say"*).
--
-- Before: answers were couple-only (`event_access_requests_host_answer`), and
-- the GRANT was written by the couple's own session upserting
-- `event_moderators` (couple-only policies) from TypeScript — so nobody else
-- could ever answer, and the level rule lived only in `grantLevelFor`.
--
-- Now ONE answer path, in the database: `answer_area_access_request`.
--   · WHO MAY ANSWER: a couple member of the event (the hosts), OR the booked
--     coordinator (`is_booked_coordinator_for`) — but the coordinator only an
--     ask stamped `answerable_by_coordinator`, which is TRUE exactly when the
--     asker is a booked supplier who is NOT the coordinator. Never the asker
--     themselves (no self-approval), never a coordinator the hosts set to
--     Limited (`is_limited_helper`: "view every part, change nothing").
--   · WHAT THE COORDINATOR MAY SHARE: only a part they hold themselves (their
--     own level is not NULL). They may decline any line. A line they leave
--     untouched is not granted — exactly the hosts' rule.
--   · THE LEVEL (mirror: `grantLevelFor`, lib/floor-command.ts): the booked
--     coordinator's ask → 'edit' where a host can set Edit, 'view' on the
--     budget; any other supplier's → 'view' (they see and propose).
--   · THE SEAT: merged, never replaced. A seat with no `areas` map is first
--     MATERIALISED (every area written out at what it resolves to today — the
--     2026-08-25 lesson, `materializeAreas`), then the granted lines set. A
--     removed seat restarts from the narrow template, never from what it held
--     before it was taken away. A live seat keeps its role (a co-host stays a
--     co-host); a new one is the supplier's role, 'wedding_planner_external'.
--
-- `answerable_by_coordinator` is FORCED by a trigger — computed at insert from
-- the asker, unchangeable after — so a supplier cannot stamp their own ask as
-- coordinator-answerable to route it past the hosts.
-- ============================================================================

-- 0 · The booked-coordinator fact for a named user — the ONE definition. The
--     caller's own answer (`is_booked_coordinator`, 20271329284628) is re-pointed
--     at it below, so the two can never disagree.
CREATE OR REPLACE FUNCTION public.is_booked_coordinator_for(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_event_id IS NOT NULL
     AND p_user_id IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM public.event_vendors ev
         JOIN public.vendor_profiles vp ON vp.vendor_profile_id = ev.marketplace_vendor_id
        WHERE ev.event_id = p_event_id
          AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
          AND public.services_make_a_coordinator(vp.services)
          AND (
            vp.user_id = p_user_id
            OR EXISTS (
              SELECT 1 FROM public.vendor_team_members tm
               WHERE tm.vendor_profile_id = vp.vendor_profile_id
                 AND tm.user_id = p_user_id
            )
          )
     );
$$;
REVOKE ALL ON FUNCTION public.is_booked_coordinator_for(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_booked_coordinator_for(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.is_booked_coordinator(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_booked_coordinator_for(p_event_id, (SELECT auth.uid()));
$$;

-- 1 · The stamp: who may answer this ask besides the hosts.
ALTER TABLE public.event_access_requests
  ADD COLUMN IF NOT EXISTS answerable_by_coordinator BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.event_access_requests.answerable_by_coordinator IS
  'TRUE when the asker was a booked supplier who is NOT the coordinator (supplier_proposes_only_for) at the moment of asking — then the booked coordinator may answer too (owner 8 Nov 2026). Forced by a trigger; a coordinator''s own ask is always FALSE (hosts only).';

CREATE OR REPLACE FUNCTION public.stamp_access_request_answerer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.answerable_by_coordinator :=
      NEW.kind = 'areas' AND public.supplier_proposes_only_for(NEW.event_id, NEW.requester_user_id);
  ELSE
    NEW.answerable_by_coordinator := OLD.answerable_by_coordinator;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.stamp_access_request_answerer() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_access_requests_stamp_answerer ON public.event_access_requests;
CREATE TRIGGER event_access_requests_stamp_answerer
  BEFORE INSERT OR UPDATE ON public.event_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.stamp_access_request_answerer();

-- 2 · The coordinator READS the asks they may answer — never their own, never a
--     coordinator's, never another event's. (Canonical pattern: an event-id set
--     from a helper, plus a row predicate.)
DROP POLICY IF EXISTS event_access_requests_coordinator_read ON public.event_access_requests;
CREATE POLICY event_access_requests_coordinator_read
  ON public.event_access_requests FOR SELECT TO authenticated
  USING (
    answerable_by_coordinator
    AND requester_user_id <> (SELECT auth.uid())
    AND event_id IN (SELECT public.current_coordinator_booked_event_ids())
  );

-- 3 · The one answer path.
CREATE OR REPLACE FUNCTION public.answer_area_access_request(p_request_id UUID, p_verdicts JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_req        RECORD;
  v_as         TEXT;
  v_req_coord  BOOLEAN;
  v_area       TEXT;
  v_verdict    TEXT;
  v_level      TEXT;
  v_decisions  JSONB := '{}'::jsonb;
  v_granted    TEXT[] := ARRAY[]::TEXT[];
  v_seat       RECORD;
  v_has_seat   BOOLEAN := FALSE;
  v_perms      JSONB;
  v_areas      JSONB;
  v_template   CONSTANT JSONB := jsonb_build_object(
                  'edit_all', FALSE, 'checkout', FALSE, 'invite_hosts', FALSE, 'remove_hosts', FALSE);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'answer_area_access_request: not signed in' USING ERRCODE = '42501';
  END IF;

  SELECT request_id, event_id, requester_user_id, requested_areas, status, kind, answerable_by_coordinator
    INTO v_req
    FROM public.event_access_requests
   WHERE request_id = p_request_id
   FOR UPDATE;
  IF NOT FOUND OR v_req.kind <> 'areas' THEN
    RAISE EXCEPTION 'answer_area_access_request: no such ask' USING ERRCODE = 'P0002';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'answer_area_access_request: already answered' USING ERRCODE = '55000';
  END IF;
  IF v_req.requester_user_id = v_uid THEN
    RAISE EXCEPTION 'answer_area_access_request: nobody answers their own ask' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.event_members m
     WHERE m.event_id = v_req.event_id AND m.user_id = v_uid AND m.member_type = 'couple'
  ) AND NOT public.is_limited_helper(v_req.event_id) THEN
    v_as := 'host';
  ELSIF v_req.answerable_by_coordinator
        AND public.is_booked_coordinator(v_req.event_id)
        AND NOT public.is_limited_helper(v_req.event_id) THEN
    v_as := 'coordinator';
  ELSE
    RAISE EXCEPTION 'answer_area_access_request: only a host or the coordinator answers this ask' USING ERRCODE = '42501';
  END IF;

  v_req_coord := public.is_booked_coordinator_for(v_req.event_id, v_req.requester_user_id);

  FOREACH v_area IN ARRAY v_req.requested_areas LOOP
    v_verdict := p_verdicts ->> v_area;
    IF v_verdict IS NULL OR v_verdict NOT IN ('granted', 'declined') THEN
      CONTINUE;
    END IF;
    IF v_verdict = 'granted' AND v_as = 'coordinator'
       AND public.moderator_area_level(v_req.event_id, v_area) IS NULL THEN
      RAISE EXCEPTION 'answer_area_access_request: the coordinator cannot share %, which they do not hold', v_area
        USING ERRCODE = '42501';
    END IF;
    v_decisions := v_decisions || jsonb_build_object(v_area, v_verdict);
    IF v_verdict = 'granted' THEN
      v_granted := v_granted || v_area;
    END IF;
  END LOOP;

  IF v_decisions = '{}'::jsonb THEN
    RAISE EXCEPTION 'answer_area_access_request: choose share or decline for at least one part' USING ERRCODE = '22023';
  END IF;

  IF cardinality(v_granted) > 0 THEN
    SELECT moderator_id, permissions_json, removed_at
      INTO v_seat
      FROM public.event_moderators
     WHERE event_id = v_req.event_id AND user_id = v_req.requester_user_id
     FOR UPDATE;
    -- Captured at once: a later FOREACH resets FOUND.
    v_has_seat := FOUND;

    IF v_has_seat AND v_seat.removed_at IS NULL THEN
      v_perms := COALESCE(v_seat.permissions_json, v_template);
    ELSE
      v_perms := v_template;
    END IF;

    -- Materialise: every area written out at what this seat resolves to today.
    IF v_perms ? 'areas' AND jsonb_typeof(v_perms -> 'areas') = 'object' THEN
      v_areas := v_perms -> 'areas';
    ELSE
      v_areas := '{}'::jsonb;
      FOREACH v_area IN ARRAY ARRAY['guest_list', 'seat_plan', 'schedule', 'vendors', 'invitations', 'mood_board', 'budget', 'photos'] LOOP
        v_level := CASE
          WHEN v_area = 'budget'
            THEN CASE WHEN COALESCE((v_perms ->> 'checkout')::boolean, FALSE) THEN 'view' END
          WHEN v_area = 'mood_board' THEN 'view'
          WHEN v_area IN ('guest_list', 'seat_plan', 'schedule', 'vendors', 'invitations')
            THEN CASE WHEN COALESCE((v_perms ->> 'edit_all')::boolean, FALSE) THEN 'edit' ELSE 'view' END
          ELSE NULL
        END;
        v_areas := v_areas || jsonb_build_object(v_area, v_level);
      END LOOP;
    END IF;

    FOREACH v_area IN ARRAY v_granted LOOP
      v_level := CASE
        WHEN v_req_coord AND v_area IN ('guest_list', 'seat_plan', 'schedule', 'vendors', 'mood_board') THEN 'edit'
        ELSE 'view'
      END;
      v_areas := v_areas || jsonb_build_object(v_area, v_level);
    END LOOP;
    v_perms := v_perms || jsonb_build_object('areas', v_areas);

    IF v_has_seat THEN
      UPDATE public.event_moderators
         SET permissions_json = v_perms,
             role_subtype     = CASE WHEN removed_at IS NOT NULL THEN 'wedding_planner_external' ELSE role_subtype END,
             accepted_at      = CASE WHEN removed_at IS NOT NULL THEN now() ELSE COALESCE(accepted_at, now()) END,
             removed_at       = NULL
       WHERE moderator_id = v_seat.moderator_id;
    ELSE
      INSERT INTO public.event_moderators
        (event_id, user_id, role_subtype, permissions_json, invited_by_user_id, accepted_at)
      VALUES
        (v_req.event_id, v_req.requester_user_id, 'wedding_planner_external', v_perms, v_uid, now());
    END IF;
  END IF;

  UPDATE public.event_access_requests
     SET status = 'answered',
         decisions = v_decisions,
         decided_by_user_id = v_uid
   WHERE request_id = p_request_id;

  RETURN jsonb_build_object(
    'answered_as', v_as,
    'decisions', v_decisions,
    'asker_is_coordinator', v_req_coord,
    'requester_user_id', v_req.requester_user_id
  );
END;
$$;

COMMENT ON FUNCTION public.answer_area_access_request(UUID, JSONB) IS
  'THE answer path for a supplier''s area ask (owner 8 Nov 2026): a host, or the booked coordinator for a non-coordinator''s ask (answerable_by_coordinator) — never the asker, never a Limited seat. The coordinator shares only parts they hold. Level: the booked coordinator''s ask → edit (budget view); any other supplier → view (see and propose). The seat is merged after materialising its areas.';

REVOKE ALL ON FUNCTION public.answer_area_access_request(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answer_area_access_request(UUID, JSONB) TO authenticated, service_role;
