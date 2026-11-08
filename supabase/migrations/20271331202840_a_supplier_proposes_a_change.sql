-- a_supplier_proposes_a_change
-- ============================================================================
-- ✍️ A SUPPLIER'S CHANGE TO THE GUEST LIST, THE SEAT PLAN OR THE SUPPLIERS IS A
-- REQUEST THAT A HOST OR THE BOOKED COORDINATOR ACCEPTS (owner rule, 8 Nov
-- 2026: *"they only see these specific parts and edit it as needed. only
-- coordinator and hosts has the final say. so any supplier that is not a
-- coordinator still has to request a host or coordinator to accept the
-- change."*).
--
-- The schedule (`event_schedule_suggestions`) and the mood board
-- (`event_inspiration_suggestions`) already had request paths. The guest list,
-- the seat plan and the suppliers had none: a grant wrote directly. Since
-- 20271329978605 a non-coordinator supplier's seat is capped at 'view', so it
-- cannot write — and this table is where their edit goes instead.
--
-- ── ONE GENERIC TABLE, FIVE NAMED CHANGES ──────────────────────────────────
-- The schedule suggestion's shape (one column per proposed field) does not
-- generalise to three different tables. A named change + a whitelisted payload
-- does, and the whitelist is enforced at INSERT (`change_request_payload_ok`):
--   guest_list · guest_add     {first_name, last_name, side?}
--   guest_list · guest_edit    target = guests.guest_id,
--                              {changes: first_name · last_name · mobile ·
--                               email · meal_preference · dietary_restrictions}
--   guest_list · guest_remove  target = guests.guest_id (the soft delete)
--   seat_plan  · seat_move     target = guests.guest_id, {table_id | null}
--   vendors    · supplier_edit target = event_vendors.vendor_id,
--                              {changes: contact_phone · contact_email · crew_size}
-- Nothing else can be proposed — never a price, a status or a payment.
--
-- ── ACCEPT IS APPLIED IN PLACE, ATOMICALLY ─────────────────────────────────
-- `answer_event_change_request` (SECURITY DEFINER) checks the answerer — a
-- host (couple member, not Limited) or the booked coordinator holding EDIT on
-- that part, never the proposer — applies the one named change to the one
-- target ON THIS EVENT, and marks the row accepted in the same transaction. A
-- target that is gone raises, so a refused change never reads 'accepted' over
-- an unchanged list. The row triggers on guests / seats / suppliers (locks,
-- the delegate audit log) still run, as the answerer.
--
-- RLS at CREATE (canonical patterns): the proposer reads their own; the hosts
-- and the booked coordinator read the event's; a booked supplier holding at
-- least VIEW on that part inserts in their own name; the proposer may withdraw
-- their own open row. No UPDATE policy answers — only the function does.
-- ============================================================================

-- 1 · The whitelist — IMMUTABLE, so a CHECK may call it.
CREATE OR REPLACE FUNCTION public.change_request_payload_ok(p_op TEXT, p_payload JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  -- COALESCE(…, FALSE): a CHECK PASSES on NULL, and bool_and over no keys is NULL — an empty or odd payload must fail.
  SELECT COALESCE(jsonb_typeof(p_payload) = 'object'
     AND CASE p_op
       WHEN 'guest_add' THEN
         (SELECT bool_and(k IN ('first_name', 'last_name', 'side')) FROM jsonb_object_keys(p_payload) k)
         AND char_length(btrim(COALESCE(p_payload ->> 'first_name', ''))) BETWEEN 1 AND 80
         AND char_length(COALESCE(p_payload ->> 'last_name', '')) <= 80
         AND COALESCE(p_payload ->> 'side', 'both') IN ('bride', 'groom', 'both')
       WHEN 'guest_edit' THEN
         (SELECT bool_and(k = 'changes') FROM jsonb_object_keys(p_payload) k)
         AND jsonb_typeof(p_payload -> 'changes') = 'object'
         AND (SELECT count(*) FROM jsonb_object_keys(p_payload -> 'changes')) BETWEEN 1 AND 6
         AND (SELECT bool_and(k IN ('first_name', 'last_name', 'mobile', 'email', 'meal_preference', 'dietary_restrictions'))
                FROM jsonb_object_keys(p_payload -> 'changes') k)
         AND (SELECT bool_and(jsonb_typeof(v) IN ('string', 'null') AND char_length(COALESCE(v #>> '{}', '')) <= 200)
                FROM jsonb_each(p_payload -> 'changes') e(k, v))
         AND COALESCE(p_payload -> 'changes' ->> 'meal_preference', 'beef')
             IN ('beef', 'chicken', 'fish', 'vegetarian', 'vegan', 'kids', 'no_preference')
       WHEN 'guest_remove' THEN p_payload = '{}'::jsonb
       WHEN 'seat_move' THEN
         (SELECT bool_and(k = 'table_id') FROM jsonb_object_keys(p_payload) k)
         AND p_payload ? 'table_id'
         AND jsonb_typeof(p_payload -> 'table_id') IN ('string', 'null')
         AND (p_payload ->> 'table_id' IS NULL
              OR p_payload ->> 'table_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
       WHEN 'supplier_edit' THEN
         (SELECT bool_and(k = 'changes') FROM jsonb_object_keys(p_payload) k)
         AND jsonb_typeof(p_payload -> 'changes') = 'object'
         AND (SELECT count(*) FROM jsonb_object_keys(p_payload -> 'changes')) BETWEEN 1 AND 3
         AND (SELECT bool_and(k IN ('contact_phone', 'contact_email', 'crew_size'))
                FROM jsonb_object_keys(p_payload -> 'changes') k)
         AND (SELECT bool_and(jsonb_typeof(v) IN ('string', 'null') AND char_length(COALESCE(v #>> '{}', '')) <= 200)
                FROM jsonb_each(p_payload -> 'changes') e(k, v))
         AND COALESCE(p_payload -> 'changes' ->> 'crew_size', '0') ~ '^[0-9]{1,3}$'
       ELSE FALSE
     END, FALSE);
$$;
REVOKE ALL ON FUNCTION public.change_request_payload_ok(TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_request_payload_ok(TEXT, JSONB) TO authenticated, service_role;

-- 2 · The table, RLS at CREATE.
CREATE TABLE IF NOT EXISTS public.event_change_requests (
  change_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  area                TEXT NOT NULL CHECK (area IN ('guest_list', 'seat_plan', 'vendors')),
  op                  TEXT NOT NULL CHECK (op IN ('guest_add', 'guest_edit', 'guest_remove', 'seat_move', 'supplier_edit')),
  -- guests.guest_id for the guest and seat changes; event_vendors.vendor_id for a supplier change; NULL to add.
  target_id           UUID,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(payload) <= 4096),
  -- What the supplier asked for, in words the hosts read ("Seat Tita Lorna at Table 4").
  summary             TEXT NOT NULL CHECK (char_length(btrim(summary)) BETWEEN 1 AND 240),
  note                TEXT CHECK (note IS NULL OR char_length(btrim(note)) BETWEEN 1 AND 240),
  proposer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_profile_id   UUID REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'declined', 'withdrawn')),
  decided_by_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at          TIMESTAMPTZ,
  answer_note         TEXT CHECK (answer_note IS NULL OR char_length(btrim(answer_note)) BETWEEN 1 AND 240),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_change_requests_op_in_area CHECK (
    (area = 'guest_list' AND op IN ('guest_add', 'guest_edit', 'guest_remove'))
    OR (area = 'seat_plan' AND op = 'seat_move')
    OR (area = 'vendors' AND op = 'supplier_edit')
  ),
  CONSTRAINT event_change_requests_target_shape CHECK ((op = 'guest_add') = (target_id IS NULL)),
  CONSTRAINT event_change_requests_payload_ok CHECK (public.change_request_payload_ok(op, payload)),
  CONSTRAINT event_change_requests_decided_dated CHECK ((status IN ('open', 'withdrawn')) OR decided_at IS NOT NULL)
);

ALTER TABLE public.event_change_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.event_change_requests IS
  'A booked supplier''s proposed change to the guest list, the seat plan or the suppliers (owner 8 Nov 2026: a supplier who is not the coordinator requests; a host or the coordinator accepts). Grants nothing and writes nothing until answer_event_change_request applies it in place.';

CREATE INDEX IF NOT EXISTS event_change_requests_event_open_idx
  ON public.event_change_requests (event_id, created_at DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS event_change_requests_proposer_idx
  ON public.event_change_requests (proposer_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_event_change_requests()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.touch_event_change_requests() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_change_requests_touch ON public.event_change_requests;
CREATE TRIGGER event_change_requests_touch
  BEFORE UPDATE ON public.event_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_event_change_requests();

REVOKE ALL ON public.event_change_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.event_change_requests TO authenticated;
-- The proposer's withdraw is the one browser-side UPDATE, and it touches status alone.
GRANT UPDATE (status) ON public.event_change_requests TO authenticated;
GRANT ALL ON public.event_change_requests TO service_role;

-- 2a · The proposer reads their own.
DROP POLICY IF EXISTS event_change_requests_own_read ON public.event_change_requests;
CREATE POLICY event_change_requests_own_read
  ON public.event_change_requests FOR SELECT TO authenticated
  USING (proposer_user_id = (SELECT auth.uid()));

-- 2b · The hosts read the event's (and admins).
DROP POLICY IF EXISTS event_change_requests_host_read ON public.event_change_requests;
CREATE POLICY event_change_requests_host_read
  ON public.event_change_requests FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()) OR (SELECT public.is_admin()));

-- 2c · The booked coordinator reads the event's.
DROP POLICY IF EXISTS event_change_requests_coordinator_read ON public.event_change_requests;
CREATE POLICY event_change_requests_coordinator_read
  ON public.event_change_requests FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_coordinator_booked_event_ids()));

-- 2d · A booked supplier holding at least VIEW on that part proposes, in their own name, open.
DROP POLICY IF EXISTS event_change_requests_supplier_insert ON public.event_change_requests;
CREATE POLICY event_change_requests_supplier_insert
  ON public.event_change_requests FOR INSERT TO authenticated
  WITH CHECK (
    proposer_user_id = (SELECT auth.uid())
    AND status = 'open'
    AND decided_by_user_id IS NULL
    AND decided_at IS NULL
    AND answer_note IS NULL
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND (
      (area = 'guest_list' AND event_id IN (
        SELECT l.event_id FROM public.current_moderator_area_levels('guest_list') l WHERE l.level IS NOT NULL))
      OR (area = 'seat_plan' AND event_id IN (
        SELECT l.event_id FROM public.current_moderator_area_levels('seat_plan') l WHERE l.level IS NOT NULL))
      OR (area = 'vendors' AND event_id IN (
        SELECT l.event_id FROM public.current_moderator_area_levels('vendors') l WHERE l.level IS NOT NULL))
    )
  );

-- 2e · The proposer withdraws their own open change. Answering is the function's alone.
DROP POLICY IF EXISTS event_change_requests_own_withdraw ON public.event_change_requests;
CREATE POLICY event_change_requests_own_withdraw
  ON public.event_change_requests FOR UPDATE TO authenticated
  USING (proposer_user_id = (SELECT auth.uid()) AND status = 'open')
  WITH CHECK (proposer_user_id = (SELECT auth.uid()) AND status = 'withdrawn');

-- 3 · Accept (applied in place) or Decline.
CREATE OR REPLACE FUNCTION public.answer_event_change_request(p_change_id UUID, p_accept BOOLEAN, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_req     RECORD;
  v_as      TEXT;
  v_key     TEXT;
  v_sets    TEXT[] := ARRAY[]::TEXT[];
  v_rows    INTEGER := 0;
  v_table   UUID;
  v_note    TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'answer_event_change_request: not signed in' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req FROM public.event_change_requests WHERE change_id = p_change_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'answer_event_change_request: no such change' USING ERRCODE = 'P0002';
  END IF;
  IF v_req.status <> 'open' THEN
    RAISE EXCEPTION 'answer_event_change_request: already answered' USING ERRCODE = '55000';
  END IF;
  IF v_req.proposer_user_id = v_uid THEN
    RAISE EXCEPTION 'answer_event_change_request: nobody answers their own change' USING ERRCODE = '42501';
  END IF;

  IF public.is_limited_helper(v_req.event_id) THEN
    RAISE EXCEPTION 'answer_event_change_request: only a host or the coordinator answers' USING ERRCODE = '42501';
  ELSIF EXISTS (
    SELECT 1 FROM public.event_members m
     WHERE m.event_id = v_req.event_id AND m.user_id = v_uid AND m.member_type = 'couple'
  ) THEN
    v_as := 'host';
  ELSIF public.is_booked_coordinator(v_req.event_id)
        AND public.moderator_area_level(v_req.event_id, v_req.area) = 'edit' THEN
    v_as := 'coordinator';
  ELSE
    RAISE EXCEPTION 'answer_event_change_request: only a host or the coordinator answers' USING ERRCODE = '42501';
  END IF;

  IF p_accept THEN
    IF v_req.op = 'guest_add' THEN
      INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
      VALUES (
        v_req.event_id,
        btrim(v_req.payload ->> 'first_name'),
        COALESCE(btrim(v_req.payload ->> 'last_name'), ''),
        COALESCE(v_req.payload ->> 'side', 'both')::public.guest_side,
        'other'::public.guest_group_category
      );
      GET DIAGNOSTICS v_rows = ROW_COUNT;

    ELSIF v_req.op = 'guest_edit' THEN
      FOR v_key IN SELECT jsonb_object_keys(v_req.payload -> 'changes') LOOP
        -- The whitelist was enforced at INSERT; asked again here so the SET can only ever name these columns.
        IF v_key NOT IN ('first_name', 'last_name', 'mobile', 'email', 'meal_preference', 'dietary_restrictions') THEN
          RAISE EXCEPTION 'answer_event_change_request: % cannot be changed', v_key USING ERRCODE = '22023';
        END IF;
        v_sets := v_sets || format('%I = %L', v_key, v_req.payload -> 'changes' ->> v_key);
      END LOOP;
      EXECUTE format(
        'UPDATE public.guests SET %s WHERE guest_id = $1 AND event_id = $2 AND deleted_at IS NULL',
        array_to_string(v_sets, ', ')
      ) USING v_req.target_id, v_req.event_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;

    ELSIF v_req.op = 'guest_remove' THEN
      UPDATE public.guests SET deleted_at = now()
       WHERE guest_id = v_req.target_id AND event_id = v_req.event_id AND deleted_at IS NULL;
      GET DIAGNOSTICS v_rows = ROW_COUNT;

    ELSIF v_req.op = 'seat_move' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.guests g
         WHERE g.guest_id = v_req.target_id AND g.event_id = v_req.event_id AND g.deleted_at IS NULL
      ) THEN
        v_rows := 0;
      ELSE
        v_table := NULLIF(v_req.payload ->> 'table_id', '')::UUID;
        IF v_table IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.event_tables t WHERE t.table_id = v_table AND t.event_id = v_req.event_id
        ) THEN
          RAISE EXCEPTION 'answer_event_change_request: that table is gone' USING ERRCODE = 'P0002';
        END IF;
        DELETE FROM public.event_seat_assignments
         WHERE event_id = v_req.event_id AND guest_id = v_req.target_id;
        IF v_table IS NOT NULL THEN
          INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id)
          VALUES (v_req.event_id, v_table, v_req.target_id);
        END IF;
        v_rows := 1;
      END IF;

    ELSIF v_req.op = 'supplier_edit' THEN
      FOR v_key IN SELECT jsonb_object_keys(v_req.payload -> 'changes') LOOP
        IF v_key NOT IN ('contact_phone', 'contact_email', 'crew_size') THEN
          RAISE EXCEPTION 'answer_event_change_request: % cannot be changed', v_key USING ERRCODE = '22023';
        END IF;
        v_sets := v_sets || format('%I = %L', v_key, v_req.payload -> 'changes' ->> v_key);
      END LOOP;
      EXECUTE format(
        'UPDATE public.event_vendors SET %s WHERE vendor_id = $1 AND event_id = $2',
        array_to_string(v_sets, ', ')
      ) USING v_req.target_id, v_req.event_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
    END IF;

    IF v_rows = 0 THEN
      RAISE EXCEPTION 'answer_event_change_request: nothing changed — the guest or supplier is gone' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  UPDATE public.event_change_requests
     SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
         decided_by_user_id = v_uid,
         decided_at = now(),
         answer_note = left(v_note, 240)
   WHERE change_id = p_change_id;

  RETURN jsonb_build_object(
    'status', CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
    'answered_as', v_as,
    'proposer_user_id', v_req.proposer_user_id,
    'event_id', v_req.event_id,
    'summary', v_req.summary
  );
END;
$$;

COMMENT ON FUNCTION public.answer_event_change_request(UUID, BOOLEAN, TEXT) IS
  'Accept (applied in place, atomically) or Decline a supplier''s proposed change (owner 8 Nov 2026). Answered by a host (couple member, not Limited) or the booked coordinator holding Edit on that part — never the proposer. Applies only the whitelisted change to the one target on the same event; a target that is gone raises and nothing is marked.';

REVOKE ALL ON FUNCTION public.answer_event_change_request(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answer_event_change_request(UUID, BOOLEAN, TEXT) TO authenticated, service_role;
