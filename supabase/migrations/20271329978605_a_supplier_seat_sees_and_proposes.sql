-- a_supplier_seat_sees_and_proposes
-- ============================================================================
-- ✋ A SUPPLIER WHO IS NOT THE COORDINATOR NEVER WRITES DIRECTLY — the database
-- says so, not only the screen (owner rule, 8 Nov 2026: *"any supplier that is
-- not a coordinator still has to request a host or coordinator to accept the
-- change"*).
--
-- ── WHAT WAS TRUE BEFORE ────────────────────────────────────────────────────
-- The host's answer to a booked supplier's area ask wrote a seat
-- (role_subtype 'wedding_planner_external') whose `areas` came from
-- `grantLevelFor`, which gave `schedule: 'edit'` to ANY supplier. So a florist
-- the hosts let see the day could move the ceremony straight through
-- `event_schedule_blocks_moderator_write` — past the schedule REQUEST path
-- (`event_schedule_suggestions`) that exists precisely so a supplier asks. And
-- any seat a host later raised to Edit in People with access was the same.
--
-- ── WHAT IS TRUE NOW ────────────────────────────────────────────────────────
-- ONE choke point. Every area-gated policy in the schema asks
-- `current_moderator_area_levels(area)` (→ `moderator_area_level`), and the
-- crew door asks `moderator_area_level_of`. Both now cap 'edit' to 'view' when
-- the seat is a SUPPLIER's seat:
--
--     role_subtype = 'wedding_planner_external'
--     AND the holder is a booked supplier on this event
--     AND the holder is NOT the booked coordinator (is_booked_coordinator's fact)
--
-- 'view' keeps every read the grant gave (guest list, seat plan, the day,
-- suppliers, mood board, budget) and is exactly the level from which a
-- supplier PROPOSES: the schedule's request path, the mood board's suggestion
-- path, and `event_change_requests` (next migrations) for the guest list, the
-- seat plan and the suppliers. Nothing about the hosts' own delegates moves: a
-- seat held by somebody who is not a booked supplier (the couple's own planner
-- invited by email, a co-host, a ninong) is untouched, and so is any seat whose
-- role is not the supplier's role (a booked photographer the couple ALSO
-- invited as best man keeps what the couple gave him).
--
-- Mirrored in TypeScript by `supplierProposesOnly` + `seatAreaLevel`
-- (lib/delegate-areas.ts). `a-supplier-proposes-the-coordinator-decides.db.test.ts`
-- proves it per part.
-- ============================================================================

-- 1 · The fact, for any user (internal: the two resolvers below ask it of the
--     seat's holder). Not callable by a browser — it would answer for anybody.
CREATE OR REPLACE FUNCTION public.supplier_proposes_only_for(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH shops AS (
    SELECT vp.vendor_profile_id, vp.services
      FROM public.vendor_profiles vp
     WHERE vp.user_id = p_user_id
    UNION
    SELECT vp.vendor_profile_id, vp.services
      FROM public.vendor_team_members tm
      JOIN public.vendor_profiles vp ON vp.vendor_profile_id = tm.vendor_profile_id
     WHERE tm.user_id = p_user_id
  ),
  booked AS (
    SELECT s.services
      FROM shops s
      JOIN public.event_vendors ev ON ev.marketplace_vendor_id = s.vendor_profile_id
     WHERE ev.event_id = p_event_id
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
  )
  SELECT p_event_id IS NOT NULL
     AND p_user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM booked)
     AND NOT EXISTS (SELECT 1 FROM booked b WHERE public.services_make_a_coordinator(b.services))
     -- A HOST is never "a supplier who proposes", even when their own shop is booked on their own event (the groom's
     -- studio at his wedding, a co-host who runs the caterer): the hosts have the final say.
     AND NOT EXISTS (
       SELECT 1 FROM public.event_members em
        WHERE em.event_id = p_event_id AND em.user_id = p_user_id AND em.member_type = 'couple'
     );
$$;

COMMENT ON FUNCTION public.supplier_proposes_only_for(UUID, UUID) IS
  'True when p_user_id is a booked supplier on the event whose shop is NOT the coordinator trade, and is not a host of it (owner 8 Nov 2026). Such a supplier sees what they were granted and proposes changes; only hosts and the booked coordinator write. Internal — asked by moderator_area_level(_of) of the seat holder.';

REVOKE ALL ON FUNCTION public.supplier_proposes_only_for(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_proposes_only_for(UUID, UUID) TO service_role;

-- 1b · The caller's own answer — what the screens and the change-request
--      policies ask ("am I a supplier who proposes here?").
CREATE OR REPLACE FUNCTION public.supplier_proposes_only(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.supplier_proposes_only_for(p_event_id, (SELECT auth.uid()));
$$;

REVOKE ALL ON FUNCTION public.supplier_proposes_only(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_proposes_only(UUID) TO authenticated, service_role;

-- 2 · The resolver every area policy asks — the same CASE as before, then the
--     cap. Signature, volatility and security unchanged, so every dependent
--     policy keeps working without being recreated.
CREATE OR REPLACE FUNCTION public.moderator_area_level(p_event_id UUID, p_area TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN s.lvl = 'edit'
            AND s.role_subtype = 'wedding_planner_external'
            AND public.supplier_proposes_only_for(p_event_id, s.user_id)
             THEN 'view'
           ELSE s.lvl
         END
    FROM (
      SELECT m.role_subtype,
             m.user_id,
             CASE
               WHEN m.permissions_json -> 'areas' ? p_area
                 THEN NULLIF(m.permissions_json -> 'areas' ->> p_area, '')
               WHEN m.permissions_json ? 'areas'
                 THEN NULL
               WHEN p_area = 'budget'
                 THEN CASE WHEN COALESCE((m.permissions_json ->> 'checkout')::boolean, FALSE)
                           THEN 'view' ELSE NULL END
               WHEN p_area = 'mood_board' THEN 'view'
               WHEN p_area IN ('guest_list', 'seat_plan', 'schedule', 'vendors', 'invitations')
                 THEN CASE WHEN COALESCE((m.permissions_json ->> 'edit_all')::boolean, FALSE)
                           THEN 'edit' ELSE 'view' END
               ELSE NULL
             END AS lvl
        FROM public.event_moderators m
       WHERE m.event_id = p_event_id
         AND m.user_id = auth.uid()
         AND m.accepted_at IS NOT NULL
         AND m.removed_at IS NULL
       LIMIT 1
    ) s;
$$;

-- 3 · Its twin for a named user (the crew door, 20271297483236) — the same
--     rule, so a crew member never inherits more than the supplier they work for.
CREATE OR REPLACE FUNCTION public.moderator_area_level_of(p_event_id UUID, p_user_id UUID, p_area TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN s.lvl = 'edit'
            AND s.role_subtype = 'wedding_planner_external'
            AND public.supplier_proposes_only_for(p_event_id, s.user_id)
             THEN 'view'
           ELSE s.lvl
         END
    FROM (
      SELECT m.role_subtype,
             m.user_id,
             CASE
               WHEN m.permissions_json -> 'areas' ? p_area
                 THEN NULLIF(m.permissions_json -> 'areas' ->> p_area, '')
               WHEN m.permissions_json ? 'areas'
                 THEN NULL
               WHEN p_area = 'budget'
                 THEN CASE WHEN COALESCE((m.permissions_json ->> 'checkout')::boolean, FALSE)
                           THEN 'view' ELSE NULL END
               WHEN p_area = 'mood_board' THEN 'view'
               WHEN p_area IN ('guest_list', 'seat_plan', 'schedule', 'vendors', 'invitations')
                 THEN CASE WHEN COALESCE((m.permissions_json ->> 'edit_all')::boolean, FALSE)
                           THEN 'edit' ELSE 'view' END
               ELSE NULL
             END AS lvl
        FROM public.event_moderators m
       WHERE m.event_id = p_event_id
         AND m.user_id = p_user_id
         AND m.accepted_at IS NOT NULL
         AND m.removed_at IS NULL
       LIMIT 1
    ) s;
$$;
REVOKE ALL ON FUNCTION public.moderator_area_level_of(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
