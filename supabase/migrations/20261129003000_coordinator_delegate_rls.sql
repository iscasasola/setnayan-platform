-- ============================================================================
-- COORDINATOR DELEGATE — Phase 2 of the feature-access-by-category program
-- (corpus: 03_Strategy/Feature_Access_By_Vendor_Category_2026-06-12.md § 3,
--  owner-locked 2026-06-12; D1 budget OFF-default→View-raiseable, D4 gates).
--
-- The 0048 invite/accept machinery (event_moderators + /hosts page +
-- /host/accept/[token]) shipped 2026-05-20 but stayed DORMANT: an accepted
-- host had no RLS access to anything and the dashboard layout 404'd them.
-- This migration wires it live:
--
--   1. Helper fns: active-moderator membership + per-area grant resolution
--      (permissions_json.areas overrides; legacy edit_all/checkout fall back)
--   2. event_action_log — every delegate write recorded, couple-readable
--      ("your coordinator did X" stream)
--   3. Generic delegate-audit trigger on the 6 planning tables
--   4. Publish guard: floor-plan publish (QR mint, irreversible) stays
--      couple-confirmed even for delegates with seat-plan edit
--   5. Moderator RLS: read baseline on planning tables; per-area writes;
--      budget SELECT only when explicitly raised to 'view' (locked D1)
--
-- Areas: guest_list · seat_plan · schedule · vendors · invitations ·
--        mood_board · budget. Chat join-all + invitations send are wired in
--        later phases (5); the grant vocabulary lands now.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1 · Helpers
-- ---------------------------------------------------------------------------

-- Events where the caller is an ACTIVE (accepted, not removed) moderator.
CREATE OR REPLACE FUNCTION public.current_moderator_event_ids()
RETURNS SETOF UUID
LANGUAGE SQL SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT event_id FROM public.event_moderators
  WHERE user_id = auth.uid()
    AND accepted_at IS NOT NULL
    AND removed_at IS NULL;
$$;

-- Per-area grant for the caller on one event: 'edit' | 'view' | NULL.
-- permissions_json.areas.<area> wins when present; otherwise the legacy 0048
-- template semantics fall back: edit_all ⇒ edit on the planning areas (view
-- otherwise), checkout ⇒ budget view, mood_board defaults to view. Budget
-- never falls back to edit (locked D1: Edit never in V1).
CREATE OR REPLACE FUNCTION public.moderator_area_level(p_event_id UUID, p_area TEXT)
RETURNS TEXT
LANGUAGE SQL SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN m.permissions_json -> 'areas' ? p_area
      THEN NULLIF(m.permissions_json -> 'areas' ->> p_area, '')
    WHEN p_area = 'budget'
      THEN CASE WHEN COALESCE((m.permissions_json ->> 'checkout')::boolean, FALSE)
                THEN 'view' ELSE NULL END
    WHEN p_area = 'mood_board' THEN 'view'
    WHEN p_area IN ('guest_list', 'seat_plan', 'schedule', 'vendors', 'invitations')
      THEN CASE WHEN COALESCE((m.permissions_json ->> 'edit_all')::boolean, FALSE)
                THEN 'edit' ELSE 'view' END
    ELSE NULL
  END
  FROM public.event_moderators m
  WHERE m.event_id = p_event_id
    AND m.user_id = auth.uid()
    AND m.accepted_at IS NOT NULL
    AND m.removed_at IS NULL
  LIMIT 1;
$$;

-- Is the caller a couple member on the event? (used by the publish guard +
-- audit trigger to separate couple writes from delegate writes)
CREATE OR REPLACE FUNCTION public.is_couple_member(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_members
    WHERE event_id = p_event_id AND user_id = auth.uid() AND member_type = 'couple'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2 · event_action_log — ADOPTED from the 0016 wizard-architecture schema
--     (migration 20260518500000), which already ships exactly this table:
--     "audit trail + your-coordinator-did-X stream (0016 § 0d)" with
--     performed_by_role CHECK including 'coordinator'. We reuse it rather
--     than duplicate it; only the couple-read policy is refreshed to add
--     the admin lens.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS event_action_log_couple_read ON public.event_action_log;
CREATE POLICY event_action_log_couple_read
  ON public.event_action_log FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 3 · Delegate audit trigger (generic across the planning tables)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_delegate_write()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_area TEXT;
  v_target_id TEXT;
  v_summary TEXT;
BEGIN
  -- Service-role / system writes (no auth context) are not delegate actions.
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_event_id := COALESCE(
    (to_jsonb(COALESCE(NEW, OLD)) ->> 'event_id')::UUID, NULL);
  IF v_event_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Couple writes aren't logged here — the stream is "what my delegate did".
  IF public.is_couple_member(v_event_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Only log when the actor is an active moderator on the event.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_moderators m
    WHERE m.event_id = v_event_id AND m.user_id = auth.uid()
      AND m.accepted_at IS NOT NULL AND m.removed_at IS NULL
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_area := CASE TG_TABLE_NAME
    WHEN 'guests' THEN 'guest_list'
    WHEN 'households' THEN 'guest_list'
    WHEN 'event_tables' THEN 'seat_plan'
    WHEN 'event_seat_assignments' THEN 'seat_plan'
    WHEN 'event_floor_plan' THEN 'seat_plan'
    WHEN 'event_schedule_blocks' THEN 'schedule'
    WHEN 'event_vendors' THEN 'vendors'
    ELSE NULL
  END;

  v_target_id := CASE TG_TABLE_NAME
    WHEN 'guests' THEN (to_jsonb(COALESCE(NEW, OLD)) ->> 'guest_id')
    WHEN 'households' THEN (to_jsonb(COALESCE(NEW, OLD)) ->> 'household_id')
    WHEN 'event_tables' THEN (to_jsonb(COALESCE(NEW, OLD)) ->> 'table_id')
    WHEN 'event_seat_assignments' THEN (to_jsonb(COALESCE(NEW, OLD)) ->> 'assignment_id')
    WHEN 'event_floor_plan' THEN (to_jsonb(COALESCE(NEW, OLD)) ->> 'event_id')
    WHEN 'event_schedule_blocks' THEN (to_jsonb(COALESCE(NEW, OLD)) ->> 'block_id')
    WHEN 'event_vendors' THEN (to_jsonb(COALESCE(NEW, OLD)) ->> 'vendor_id')
    ELSE NULL
  END;

  v_summary := CASE TG_TABLE_NAME
    WHEN 'guests' THEN NULLIF(TRIM(CONCAT(
      to_jsonb(COALESCE(NEW, OLD)) ->> 'first_name', ' ',
      to_jsonb(COALESCE(NEW, OLD)) ->> 'last_name')), '')
    WHEN 'households' THEN (to_jsonb(COALESCE(NEW, OLD)) ->> 'name')
    WHEN 'event_tables' THEN (to_jsonb(COALESCE(NEW, OLD)) ->> 'table_label')
    WHEN 'event_schedule_blocks' THEN (to_jsonb(COALESCE(NEW, OLD)) ->> 'label')
    WHEN 'event_vendors' THEN (to_jsonb(COALESCE(NEW, OLD)) ->> 'vendor_name')
    WHEN 'event_floor_plan' THEN 'floor plan'
    ELSE NULL
  END;

  -- 0016 table shape: action_type free-text, performed_by_role constrained
  -- to couple|coordinator|planner|system. Delegates log as 'coordinator'.
  INSERT INTO public.event_action_log
    (event_id, action_type, action_target_table, action_target_id,
     performed_by_user_id, performed_by_role, notes, payload_json)
  VALUES
    (v_event_id,
     'delegate_' || lower(TG_OP),
     TG_TABLE_NAME,
     v_target_id::UUID,
     auth.uid(),
     'coordinator',
     v_summary,
     jsonb_build_object('area', v_area));

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS guests_delegate_audit ON public.guests;
CREATE TRIGGER guests_delegate_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.log_delegate_write();

DROP TRIGGER IF EXISTS households_delegate_audit ON public.households;
CREATE TRIGGER households_delegate_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.log_delegate_write();

DROP TRIGGER IF EXISTS event_tables_delegate_audit ON public.event_tables;
CREATE TRIGGER event_tables_delegate_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.event_tables
  FOR EACH ROW EXECUTE FUNCTION public.log_delegate_write();

DROP TRIGGER IF EXISTS event_seat_assignments_delegate_audit ON public.event_seat_assignments;
CREATE TRIGGER event_seat_assignments_delegate_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.event_seat_assignments
  FOR EACH ROW EXECUTE FUNCTION public.log_delegate_write();

DROP TRIGGER IF EXISTS event_floor_plan_delegate_audit ON public.event_floor_plan;
CREATE TRIGGER event_floor_plan_delegate_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.event_floor_plan
  FOR EACH ROW EXECUTE FUNCTION public.log_delegate_write();

DROP TRIGGER IF EXISTS event_schedule_blocks_delegate_audit ON public.event_schedule_blocks;
CREATE TRIGGER event_schedule_blocks_delegate_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.event_schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION public.log_delegate_write();

DROP TRIGGER IF EXISTS event_vendors_delegate_audit ON public.event_vendors;
CREATE TRIGGER event_vendors_delegate_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.log_delegate_write();

-- ---------------------------------------------------------------------------
-- 4 · Publish guard — floor-plan publish stays couple-confirmed (doc § 3:
--     "publish stays couple-confirmed — QR mint is irreversible")
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_couple_publish()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.published_at IS NULL AND NEW.published_at IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND NOT public.is_couple_member(NEW.event_id)
  THEN
    RAISE EXCEPTION 'publish_requires_couple'
      USING HINT = 'Only the couple can publish the seat plan. Ask them to confirm.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_floor_plan_publish_guard ON public.event_floor_plan;
CREATE TRIGGER event_floor_plan_publish_guard
  BEFORE UPDATE ON public.event_floor_plan
  FOR EACH ROW EXECUTE FUNCTION public.enforce_couple_publish();

-- ---------------------------------------------------------------------------
-- 5 · Moderator RLS — read baseline + per-area writes
-- ---------------------------------------------------------------------------

-- events: active moderators can read the event row (the dashboard shell).
DROP POLICY IF EXISTS events_moderator_read ON public.events;
CREATE POLICY events_moderator_read ON public.events
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_moderator_event_ids()));

-- Read baseline on the planning tables (View is the moderator floor).
DROP POLICY IF EXISTS guests_moderator_read ON public.guests;
CREATE POLICY guests_moderator_read ON public.guests
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_moderator_event_ids()));

DROP POLICY IF EXISTS households_moderator_read ON public.households;
CREATE POLICY households_moderator_read ON public.households
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_moderator_event_ids()));

DROP POLICY IF EXISTS event_tables_moderator_read ON public.event_tables;
CREATE POLICY event_tables_moderator_read ON public.event_tables
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_moderator_event_ids()));

DROP POLICY IF EXISTS event_seat_assignments_moderator_read ON public.event_seat_assignments;
CREATE POLICY event_seat_assignments_moderator_read ON public.event_seat_assignments
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_moderator_event_ids()));

DROP POLICY IF EXISTS event_floor_plan_moderator_read ON public.event_floor_plan;
CREATE POLICY event_floor_plan_moderator_read ON public.event_floor_plan
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_moderator_event_ids()));

DROP POLICY IF EXISTS event_schedule_blocks_moderator_read ON public.event_schedule_blocks;
CREATE POLICY event_schedule_blocks_moderator_read ON public.event_schedule_blocks
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_moderator_event_ids()));

DROP POLICY IF EXISTS event_vendors_moderator_read ON public.event_vendors;
CREATE POLICY event_vendors_moderator_read ON public.event_vendors
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_moderator_event_ids()));

-- Budget: SELECT only when explicitly raised to 'view' (locked D1 — OFF by
-- default, couple-raiseable, never edit in V1). No moderator write policies.
DROP POLICY IF EXISTS event_vendor_line_items_moderator_read ON public.event_vendor_line_items;
CREATE POLICY event_vendor_line_items_moderator_read ON public.event_vendor_line_items
  FOR SELECT TO authenticated
  USING (public.moderator_area_level(event_id, 'budget') IN ('view', 'edit'));

DROP POLICY IF EXISTS event_vendor_payments_moderator_read ON public.event_vendor_payments;
CREATE POLICY event_vendor_payments_moderator_read ON public.event_vendor_payments
  FOR SELECT TO authenticated
  USING (public.moderator_area_level(event_id, 'budget') IN ('view', 'edit'));

-- Per-area writes (grant level 'edit').

-- guest_list → guests + households
DROP POLICY IF EXISTS guests_moderator_write ON public.guests;
CREATE POLICY guests_moderator_write ON public.guests
  FOR ALL TO authenticated
  USING (public.moderator_area_level(event_id, 'guest_list') = 'edit')
  WITH CHECK (public.moderator_area_level(event_id, 'guest_list') = 'edit');

DROP POLICY IF EXISTS households_moderator_write ON public.households;
CREATE POLICY households_moderator_write ON public.households
  FOR ALL TO authenticated
  USING (public.moderator_area_level(event_id, 'guest_list') = 'edit')
  WITH CHECK (public.moderator_area_level(event_id, 'guest_list') = 'edit');

-- seat_plan → tables + assignments + floor plan (publish guarded above)
DROP POLICY IF EXISTS event_tables_moderator_write ON public.event_tables;
CREATE POLICY event_tables_moderator_write ON public.event_tables
  FOR ALL TO authenticated
  USING (public.moderator_area_level(event_id, 'seat_plan') = 'edit')
  WITH CHECK (public.moderator_area_level(event_id, 'seat_plan') = 'edit');

DROP POLICY IF EXISTS event_seat_assignments_moderator_write ON public.event_seat_assignments;
CREATE POLICY event_seat_assignments_moderator_write ON public.event_seat_assignments
  FOR ALL TO authenticated
  USING (public.moderator_area_level(event_id, 'seat_plan') = 'edit')
  WITH CHECK (public.moderator_area_level(event_id, 'seat_plan') = 'edit');

DROP POLICY IF EXISTS event_floor_plan_moderator_write ON public.event_floor_plan;
CREATE POLICY event_floor_plan_moderator_write ON public.event_floor_plan
  FOR ALL TO authenticated
  USING (public.moderator_area_level(event_id, 'seat_plan') = 'edit')
  WITH CHECK (public.moderator_area_level(event_id, 'seat_plan') = 'edit');

-- schedule → event_schedule_blocks
DROP POLICY IF EXISTS event_schedule_blocks_moderator_write ON public.event_schedule_blocks;
CREATE POLICY event_schedule_blocks_moderator_write ON public.event_schedule_blocks
  FOR ALL TO authenticated
  USING (public.moderator_area_level(event_id, 'schedule') = 'edit')
  WITH CHECK (public.moderator_area_level(event_id, 'schedule') = 'edit');

-- vendors → event_vendors (the couple's vendor records)
DROP POLICY IF EXISTS event_vendors_moderator_write ON public.event_vendors;
CREATE POLICY event_vendors_moderator_write ON public.event_vendors
  FOR ALL TO authenticated
  USING (public.moderator_area_level(event_id, 'vendors') = 'edit')
  WITH CHECK (public.moderator_area_level(event_id, 'vendors') = 'edit');

COMMENT ON FUNCTION public.moderator_area_level(UUID, TEXT) IS
  'Per-area delegate grant: permissions_json.areas.<area> wins; legacy 0048 edit_all/checkout fall back. Budget never exceeds view in V1 (locked D1).';
COMMENT ON FUNCTION public.log_delegate_write() IS
  'Feature-access program Phase 2: records non-couple moderator writes on the planning tables into the 0016 event_action_log (couple-visible "your coordinator did X" stream).';
