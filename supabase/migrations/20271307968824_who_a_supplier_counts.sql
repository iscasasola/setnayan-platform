-- who_a_supplier_counts
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 🧮 WHO A SUPPLIER COUNTS (owner 2026-11-04, DECISION_LOG "2026-11-04 WHO A SUPPLIER COUNTS…"; build note
-- SUPPLIER_PLANS_GIFTS_QUOTES_BUILD_NOTES_2026-11-04.md "Round 2"). Owner, verbatim:
--   *"on the guest card it should show what services they are not included to. example a kid cannot eat the buffet.
--     so we can remove them from the count."* · *"but on cale-ice it asked for venue, and no option for catering"* ·
--   *"this way, a supplier can count what they need to give. so for example. exclusive for principal sponsors. we only
--     count the attending principal sponsors."* · *"not counted for will be for service cards with pax only. if they
--     offer a service without pax, then no need to count"*.
--
-- Three changes, one count:
--
--   1 · PER HEAD ONLY. A booking counts heads only when one of its service cards is priced per head
--       (`vendor_services.pricing_basis = 'per_pax'` on `event_vendors.service_id` or any `requested_service_ids`).
--       `event_vendor_counts_per_head` is that one test. A flat-priced booking takes no tick and no rule, and an old
--       tick on one leaves nobody out.
--   2 · ANY SUPPLIER ON THE EVENT, NOT ONLY BOOKED. "Not counted for ▾" now lists every non-archived booking of the event
--       (considering · shortlisted · quoted · booked) — the trigger keeps the same-event check and adds the per-head one.
--       The three supplier readers still hand `guests_not_counted_for_services` ONLY the caller's BOOKED bookings, so a
--       tick on a quoted caterer changes no count until it is booked (held by the db test).
--   3 · A RULE PER SERVICE — `event_vendor_count_rules`: mode `all` | `only` | `except`, plus guest roles and guest-group
--       ids. `only` counts the attending guests who hold a picked role or sit in a picked group; `except` counts every
--       attending guest but those. A deleted group drops out of every rule (trigger on guest_groups).
--
-- The rule is folded INTO `guests_not_counted_for_services`, the helper every guest read of the three readers already
-- subtracts (`g.guest_id <> ALL (v_not_counted)`), so get_vendor_event_brief / get_vendor_catering_metrics /
-- get_vendor_seat_plan honour it without being re-copied. A guest is left out of a booking when they are ticked for it
-- OR outside its rule; out of a SHOP when that holds for EVERY booking the shop is handed (unchanged).
--
-- ── WHO SEES WHAT ── the couple writes the rule (RLS, `current_couple_event_ids` + admin); a supplier never reads the
--    table or a guest: `get_vendor_headcount_rule` hands it NUMBERS (attending · not counted · outside the rule ·
--    counted) and the rule's words (role keys, group labels) — never a name, never a guest id.
--    `get_event_service_counts` hands the couple (and a guest-list helper, and the admin console) each per-head
--    service's count, its rule, and an anonymous roster (roles · groups · ticks per attending guest, no ids, no names)
--    so the rule sheet's count moves as they tick.
--
-- Held by apps/web/tests/db/who-a-supplier-counts.db.test.ts, apps/web/tests/db/a-guest-not-counted-for-a-service.db.test.ts
-- and apps/web/lib/who-a-supplier-counts.test.ts.

BEGIN;

-- ── 1 · Per head: the one test ────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_vendor_counts_per_head(p_event_vendor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.event_vendors ev
      JOIN public.vendor_services vs
        ON vs.vendor_service_id = ev.service_id
        OR vs.vendor_service_id = ANY (COALESCE(ev.requested_service_ids, ARRAY[]::UUID[]))
     WHERE ev.vendor_id = p_event_vendor_id
       AND vs.pricing_basis = 'per_pax'
  );
$$;
REVOKE ALL ON FUNCTION public.event_vendor_counts_per_head(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_vendor_counts_per_head(UUID) TO service_role;

-- ── 2 · "Not counted for ▾": any supplier on the event, per head only ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guest_not_counted_for_same_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event UUID;
BEGIN
  SELECT g.event_id INTO v_event FROM public.guests g WHERE g.guest_id = NEW.guest_id;
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'That guest is not on the list.' USING ERRCODE = '23503';
  END IF;
  -- Same event — in ANY status (a quote counts once it is booked; the readers only ever ask for booked ones).
  IF NOT EXISTS (
    SELECT 1 FROM public.event_vendors ev WHERE ev.vendor_id = NEW.event_vendor_id AND ev.event_id = v_event
  ) THEN
    RAISE EXCEPTION 'That service is not on this event.' USING ERRCODE = '23514';
  END IF;
  IF NOT public.event_vendor_counts_per_head(NEW.event_vendor_id) THEN
    RAISE EXCEPTION 'That service is not priced per head, so it counts nobody.' USING ERRCODE = '23514';
  END IF;
  NEW.event_id := v_event;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guest_not_counted_for_same_event() FROM PUBLIC, anon, authenticated;

-- ── 3 · The rule per service ──────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_vendor_count_rules (
  -- The booking (an `event_vendors` row); one rule each.
  event_vendor_id UUID PRIMARY KEY REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  -- Derived from the booking by the trigger below — whatever a writer sends is replaced.
  event_id        UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  mode            TEXT NOT NULL DEFAULT 'all' CHECK (mode IN ('all', 'only', 'except')),
  roles           public.guest_role[] NOT NULL DEFAULT ARRAY[]::public.guest_role[],
  group_ids       UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      UUID
);

ALTER TABLE public.event_vendor_count_rules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS event_vendor_count_rules_event_idx ON public.event_vendor_count_rules (event_id);

COMMENT ON TABLE public.event_vendor_count_rules IS
  'Who a per-head supplier counts (owner 2026-11-04): mode all | only | except over guest roles and guest groups. '
  'Folded into guests_not_counted_for_services, so the three supplier readers honour it. Couple writes; a supplier '
  'reads numbers only through get_vendor_headcount_rule. 20271306341630.';

CREATE OR REPLACE FUNCTION public.event_vendor_count_rules_shape()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event UUID;
BEGIN
  SELECT ev.event_id INTO v_event FROM public.event_vendors ev WHERE ev.vendor_id = NEW.event_vendor_id;
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'That service is not on this event.' USING ERRCODE = '23503';
  END IF;
  -- A rule is set only on a per-head service. A pure removal (a deleted group dropping out) never re-asks.
  IF TG_OP = 'INSERT'
     OR NEW.mode IS DISTINCT FROM OLD.mode
     OR NEW.roles IS DISTINCT FROM OLD.roles
     OR NOT (NEW.group_ids <@ OLD.group_ids) THEN
    IF NOT public.event_vendor_counts_per_head(NEW.event_vendor_id) THEN
      RAISE EXCEPTION 'That service is not priced per head, so it counts nobody.' USING ERRCODE = '23514';
    END IF;
  END IF;
  NEW.event_id := v_event;
  IF NEW.mode = 'all' THEN
    NEW.roles := ARRAY[]::public.guest_role[];
    NEW.group_ids := ARRAY[]::UUID[];
  ELSE
    NEW.roles := ARRAY(SELECT DISTINCT r FROM unnest(NEW.roles) AS r ORDER BY r);
    -- Only this event's own groups.
    NEW.group_ids := ARRAY(
      SELECT DISTINCT x FROM unnest(NEW.group_ids) AS x
       WHERE EXISTS (SELECT 1 FROM public.guest_groups gg WHERE gg.group_id = x AND gg.event_id = v_event)
       ORDER BY x
    );
  END IF;
  NEW.updated_at := NOW();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.event_vendor_count_rules_shape() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_vendor_count_rules_shape ON public.event_vendor_count_rules;
CREATE TRIGGER event_vendor_count_rules_shape
  BEFORE INSERT OR UPDATE ON public.event_vendor_count_rules
  FOR EACH ROW EXECUTE FUNCTION public.event_vendor_count_rules_shape();

-- A deleted group drops out of every rule that named it.
CREATE OR REPLACE FUNCTION public.event_vendor_count_rules_drop_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.event_vendor_count_rules r
     SET group_ids = array_remove(r.group_ids, OLD.group_id)
   WHERE r.event_id = OLD.event_id
     AND OLD.group_id = ANY (r.group_ids);
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.event_vendor_count_rules_drop_group() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_vendor_count_rules_drop_group ON public.guest_groups;
CREATE TRIGGER event_vendor_count_rules_drop_group
  AFTER DELETE ON public.guest_groups
  FOR EACH ROW EXECUTE FUNCTION public.event_vendor_count_rules_drop_group();

REVOKE ALL ON TABLE public.event_vendor_count_rules FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_vendor_count_rules TO authenticated;
GRANT ALL ON TABLE public.event_vendor_count_rules TO service_role;

-- The couple (the `guest_not_counted_for_couple_all` shape) and the admin. No supplier, no helper.
DROP POLICY IF EXISTS event_vendor_count_rules_couple_all ON public.event_vendor_count_rules;
CREATE POLICY event_vendor_count_rules_couple_all
  ON public.event_vendor_count_rules FOR ALL
  TO authenticated
  USING ((event_id IN (SELECT public.current_couple_event_ids())) OR (SELECT public.is_admin()))
  WITH CHECK ((event_id IN (SELECT public.current_couple_event_ids())) OR (SELECT public.is_admin()));

-- ── 4 · Who one booking leaves out — ticked, or outside its rule ──────────────────────────────────────────────────
-- Returns guest ids, so no browser role may call it. A flat-priced booking leaves nobody out.
CREATE OR REPLACE FUNCTION public.event_vendor_left_out(p_event_id UUID, p_event_vendor_id UUID)
RETURNS TABLE (guest_id UUID, outside_rule BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH ev AS (
    SELECT e.vendor_id
      FROM public.event_vendors e
     WHERE e.vendor_id = p_event_vendor_id
       AND e.event_id = p_event_id
       AND public.event_vendor_counts_per_head(e.vendor_id)
  ), r AS (
    SELECT cr.mode, cr.roles, cr.group_ids
      FROM public.event_vendor_count_rules cr
      JOIN ev ON ev.vendor_id = cr.event_vendor_id
     WHERE cr.mode <> 'all'
  ), gs AS (
    SELECT g.guest_id,
           CASE
             WHEN r.mode IS NULL THEN FALSE
             ELSE COALESCE(
               (g.role = ANY (r.roles)
                OR COALESCE(g.extra_roles, ARRAY[]::public.guest_role[]) && r.roles
                OR EXISTS (
                  SELECT 1 FROM public.guest_group_memberships m
                   WHERE m.guest_id = g.guest_id AND m.group_id = ANY (r.group_ids)
                )) = (r.mode = 'except'),
               FALSE)
           END AS outside
      FROM public.guests g
      CROSS JOIN ev
      LEFT JOIN r ON TRUE
     WHERE g.event_id = p_event_id
  )
  SELECT gs.guest_id, gs.outside
    FROM gs
   WHERE gs.outside
      OR EXISTS (
        SELECT 1 FROM public.guest_not_counted_for n
         WHERE n.guest_id = gs.guest_id AND n.event_vendor_id = p_event_vendor_id
      );
$$;
REVOKE ALL ON FUNCTION public.event_vendor_left_out(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_vendor_left_out(UUID, UUID) TO service_role;

-- ── 5 · The helper the three readers already subtract — now ticks AND rules ───────────────────────────────────────
-- Left out of EVERY one of the given bookings. Never NULL (`<> ALL (NULL)` would leave everyone out). No bookings →
-- nobody. The readers hand it the caller's BOOKED bookings only, so an unbooked tick or rule changes no count.
CREATE OR REPLACE FUNCTION public.guests_not_counted_for_services(p_event_id UUID, p_event_vendor_ids UUID[])
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH s AS (
    SELECT DISTINCT u AS id FROM unnest(COALESCE(p_event_vendor_ids, ARRAY[]::UUID[])) AS u WHERE u IS NOT NULL
  )
  SELECT COALESCE((
    SELECT ARRAY_AGG(x.guest_id)
      FROM (
        SELECT lo.guest_id
          FROM s
          CROSS JOIN LATERAL public.event_vendor_left_out(p_event_id, s.id) lo
         GROUP BY lo.guest_id
        HAVING COUNT(DISTINCT s.id) = (SELECT COUNT(*) FROM s)
      ) x
  ), ARRAY[]::UUID[]);
$$;
REVOKE ALL ON FUNCTION public.guests_not_counted_for_services(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guests_not_counted_for_services(UUID, UUID[]) TO service_role;

-- ── 6 · The numbers — attending · not counted · outside the rule · counted ────────────────────────────────────────
-- Over the SAME guests the readers count as attending (the request · passed away · represented rules), so `counted`
-- is exactly the readers' attending number. Counts only, never a guest.
CREATE OR REPLACE FUNCTION public.event_vendor_headcount(p_event_id UUID, p_event_vendor_ids UUID[])
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH s AS (
    SELECT DISTINCT u AS id FROM unnest(COALESCE(p_event_vendor_ids, ARRAY[]::UUID[])) AS u WHERE u IS NOT NULL
  ), l AS (
    SELECT lo.guest_id, bool_and(lo.outside_rule) AS outside, COUNT(DISTINCT s.id) AS k
      FROM s
      CROSS JOIN LATERAL public.event_vendor_left_out(p_event_id, s.id) lo
     GROUP BY lo.guest_id
  ), a AS (
    SELECT g.guest_id
      FROM public.guests g
     WHERE g.event_id = p_event_id AND g.deleted_at IS NULL AND g.entry_source <> 'self_added_unlisted'
       AND NOT g.passed_away AND g.represented_by_guest_id IS NULL
       AND g.rsvp_status = 'attending'
  ), c AS (
    SELECT
      (SELECT COUNT(*) FROM a)::INT AS attending,
      (SELECT COUNT(*) FROM a JOIN l USING (guest_id) WHERE l.k = (SELECT COUNT(*) FROM s) AND l.outside)::INT AS outside_rule,
      (SELECT COUNT(*) FROM a JOIN l USING (guest_id) WHERE l.k = (SELECT COUNT(*) FROM s) AND NOT l.outside)::INT AS not_counted
  )
  SELECT jsonb_build_object(
    'attending', c.attending,
    'not_counted', c.not_counted,
    'outside_rule', c.outside_rule,
    'counted', c.attending - c.not_counted - c.outside_rule
  ) FROM c;
$$;
REVOKE ALL ON FUNCTION public.event_vendor_headcount(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_vendor_headcount(UUID, UUID[]) TO service_role;

-- ── 7 · The supplier: their count and its why, numbers only ───────────────────────────────────────────────────────
-- NULL when none of the caller's booked services on this event is per head (no tile is drawn). The SAME booked set the
-- three readers hand the helper, so the number here is the number there.
CREATE OR REPLACE FUNCTION public.get_vendor_headcount_rule(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_ids UUID[];
  v_booked      UUID[];
  v_first       UUID;
  v_category    TEXT;
  v_mode        TEXT;
  v_roles       public.guest_role[];
  v_groups      UUID[];
BEGIN
  SELECT ARRAY(
    SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid()
    UNION
    SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = auth.uid()
  ) INTO v_profile_ids;
  IF COALESCE(array_length(v_profile_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'not_a_vendor' USING ERRCODE = '42501';
  END IF;

  SELECT ARRAY_AGG(ev.vendor_id ORDER BY ev.vendor_id)
    INTO v_booked
    FROM public.event_vendors ev
   WHERE ev.event_id = p_event_id
     AND ev.marketplace_vendor_id = ANY (v_profile_ids)
     AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete');
  IF v_booked IS NULL THEN
    RAISE EXCEPTION 'not_booked' USING ERRCODE = '42501';
  END IF;

  -- The per-head booking whose rule is told (a shop holds one booking per event).
  SELECT ev.vendor_id, ev.category::TEXT INTO v_first, v_category
    FROM public.event_vendors ev
   WHERE ev.vendor_id = ANY (v_booked) AND public.event_vendor_counts_per_head(ev.vendor_id)
   ORDER BY ev.vendor_id
   LIMIT 1;
  IF v_first IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT cr.mode, cr.roles, cr.group_ids INTO v_mode, v_roles, v_groups
    FROM public.event_vendor_count_rules cr WHERE cr.event_vendor_id = v_first;

  RETURN public.event_vendor_headcount(p_event_id, v_booked) || jsonb_build_object(
    'category', v_category,
    'mode', COALESCE(v_mode, 'all'),
    'roles', to_jsonb(COALESCE(v_roles, ARRAY[]::public.guest_role[])),
    -- The groups' LABELS (the couple's words, "Kids") — never who is in them.
    'groups', COALESCE((
      SELECT jsonb_agg(gg.label ORDER BY gg.label)
        FROM public.guest_groups gg
       WHERE gg.event_id = p_event_id AND gg.group_id = ANY (COALESCE(v_groups, ARRAY[]::UUID[]))
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_vendor_headcount_rule(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_headcount_rule(UUID) TO authenticated, service_role;

-- ── 8 · The couple (and a guest-list helper, and the admin console): every per-head service, its count, its rule ──
-- `roster` is one entry per ATTENDING guest the readers count — roles, groups, ticks — with no id and no name, so the
-- rule sheet's "<shop> counts N" moves as the couple ticks. A signed-in caller must be the couple, a guest-list helper
-- or an admin; no signed-in user = the service role (anon holds no grant).
CREATE OR REPLACE FUNCTION public.get_event_service_counts(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT (
       p_event_id IN (SELECT public.current_couple_event_ids())
       OR public.is_admin()
       OR p_event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('guest_list') l WHERE l.level IS NOT NULL)
     ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'services', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ev.vendor_id,
          'category', ev.category::TEXT,
          'shop', ev.vendor_name,
          'status', ev.status::TEXT,
          'booked', ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete'),
          'mode', COALESCE(cr.mode, 'all'),
          'roles', to_jsonb(COALESCE(cr.roles, ARRAY[]::public.guest_role[])),
          'group_ids', to_jsonb(COALESCE(cr.group_ids, ARRAY[]::UUID[]))
        ) || public.event_vendor_headcount(p_event_id, ARRAY[ev.vendor_id])
        ORDER BY ev.category::TEXT, ev.vendor_name, ev.vendor_id
      )
        FROM public.event_vendors ev
        LEFT JOIN public.event_vendor_count_rules cr ON cr.event_vendor_id = ev.vendor_id
       WHERE ev.event_id = p_event_id
         AND ev.archived_at IS NULL
         AND public.event_vendor_counts_per_head(ev.vendor_id)
    ), '[]'::jsonb),
    'groups', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', gg.group_id, 'label', gg.label) ORDER BY gg.label)
        FROM public.guest_groups gg WHERE gg.event_id = p_event_id
    ), '[]'::jsonb),
    'roster', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'r', to_jsonb(ARRAY[g.role] || COALESCE(g.extra_roles, ARRAY[]::public.guest_role[])),
        'g', COALESCE((SELECT jsonb_agg(m.group_id) FROM public.guest_group_memberships m WHERE m.guest_id = g.guest_id), '[]'::jsonb),
        't', COALESCE((SELECT jsonb_agg(n.event_vendor_id) FROM public.guest_not_counted_for n WHERE n.guest_id = g.guest_id), '[]'::jsonb)
      ))
        FROM public.guests g
       WHERE g.event_id = p_event_id AND g.deleted_at IS NULL AND g.entry_source <> 'self_added_unlisted'
         AND NOT g.passed_away AND g.represented_by_guest_id IS NULL
         AND g.rsvp_status = 'attending'
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_event_service_counts(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_service_counts(UUID) TO authenticated, service_role;

-- ── The fence must really be there ────────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.event_vendor_count_rules'::regclass) THEN
    RAISE EXCEPTION 'event_vendor_count_rules must have RLS on';
  END IF;
  IF has_function_privilege('authenticated', 'public.event_vendor_left_out(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'event_vendor_left_out names guests — no browser role may call it';
  END IF;
  IF has_function_privilege('authenticated', 'public.guests_not_counted_for_services(uuid, uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'guests_not_counted_for_services names guests — no browser role may call it';
  END IF;
END $$;

COMMIT;
