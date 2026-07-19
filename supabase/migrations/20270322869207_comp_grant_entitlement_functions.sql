-- 20270322869207_comp_grant_entitlement_functions.sql
--
-- Make admin-issued comp grants ACTUALLY confer free in-app access.
--
-- The problem
-- -----------
-- The /admin/users "Issue a comp grant" form (app/admin/users/actions.ts ::
-- issueCompGrant) writes a `comp_grants` row (scope = 'all_services' |
-- 'specific_skus'), but NOTHING read it. Every couple-SKU feature gate funnels
-- through apps/web/lib/entitlements.ts (eventSkuActive / eventOwnsSku /
-- eventActiveSkus), and those only query `orders`. So a comp grant unlocked
-- ZERO features — the admin gifted access that the product never honored.
--
-- Why a SECURITY DEFINER function (not a plain app query)
-- ------------------------------------------------------
-- A comp grant is USER-scoped (comp_grants.user_id), but feature gates are
-- EVENT-scoped. We must map event -> its HOST users -> their grants. Doing that
-- naively in the app is unsafe: the gates are routinely called with the
-- service-role admin client (e.g. the Studio hub passes createAdminClient()),
-- so a bare `comp_grants.eq(scope,'all_services')` would see EVERY grant in the
-- DB and unlock all paid features for EVERY couple the moment one grant exists.
-- (That is exactly the bug in the never-merged `owner-all-services-grant`
-- branch's hasAllServicesGrant().) Resolving host users server-side in one
-- definer function makes the check correct regardless of which client calls it,
-- and never leaks a grant across accounts.
--
-- Host definition mirrors lib/events.ts resolvePrimaryHostEvent(): a couple
-- member (event_members.member_type='couple') OR an accepted, non-removed
-- primary-host moderator (event_moderators). Guest/viewer/coordinator memberships
-- do NOT count — a comp on a guest must not unlock paid features on the event
-- they were merely invited to.
--
-- Two read functions, both STABLE + SECURITY DEFINER + locked search_path:
--   1. event_has_comp_for_sku(event, sku) -> bool   — the per-SKU gate
--   2. event_comp_active_skus(event)      -> text[] — the batch grid union
--      (all_services -> the full live catalog; specific_skus -> just those codes)
--
-- Additive + idempotent (CREATE OR REPLACE). No table changes; pure read helpers.

BEGIN;

-- 1. Per-SKU gate: does any HOST of this event hold an active comp grant that
--    covers `p_service_key` (all_services, or specific_skus containing it)?
CREATE OR REPLACE FUNCTION public.event_has_comp_for_sku(
  p_event_id    UUID,
  p_service_key TEXT
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.comp_grants cg
     WHERE cg.revoked_at IS NULL
       AND (cg.expiry IS NULL OR cg.expiry > NOW())
       AND (
            cg.scope = 'all_services'
         OR (cg.scope = 'specific_skus' AND p_service_key = ANY(cg.scoped_skus))
       )
       AND cg.user_id IN (
            -- Legacy couple host.
            SELECT em.user_id
              FROM public.event_members em
             WHERE em.event_id = p_event_id
               AND em.member_type = 'couple'
            UNION
            -- Iteration 0048 primary-host moderator (accepted, not removed).
            SELECT m.user_id
              FROM public.event_moderators m
             WHERE m.event_id = p_event_id
               AND m.removed_at IS NULL
               AND m.accepted_at IS NOT NULL
               AND m.role_subtype IN (
                 'bride','groom','partner1','partner2',
                 'parent_of_bride','parent_of_groom','wedding_planner_external'
               )
       )
  );
$$;

-- 2. Batch: every SKU a host's active comp grant covers, for the Studio grid.
--    all_services -> the full live retail catalog; specific_skus -> the union of
--    every scoped code. Returns an empty array (never NULL) when no comp applies.
CREATE OR REPLACE FUNCTION public.event_comp_active_skus(
  p_event_id UUID
) RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hosts   UUID[];
  v_has_all BOOLEAN;
  v_skus    TEXT[];
BEGIN
  SELECT array_agg(uid) INTO v_hosts
    FROM (
      SELECT em.user_id AS uid
        FROM public.event_members em
       WHERE em.event_id = p_event_id
         AND em.member_type = 'couple'
      UNION
      SELECT m.user_id
        FROM public.event_moderators m
       WHERE m.event_id = p_event_id
         AND m.removed_at IS NULL
         AND m.accepted_at IS NOT NULL
         AND m.role_subtype IN (
           'bride','groom','partner1','partner2',
           'parent_of_bride','parent_of_groom','wedding_planner_external'
         )
    ) h;

  IF v_hosts IS NULL THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.comp_grants cg
     WHERE cg.user_id = ANY(v_hosts)
       AND cg.revoked_at IS NULL
       AND (cg.expiry IS NULL OR cg.expiry > NOW())
       AND cg.scope = 'all_services'
  ) INTO v_has_all;

  IF v_has_all THEN
    -- Full live catalog = "every Setnayan service". Sourced from the canonical
    -- live retail catalog so new SKUs are auto-covered without touching code.
    SELECT array_agg(service_code) INTO v_skus
      FROM public.platform_retail_catalog_v2;
    RETURN COALESCE(v_skus, ARRAY[]::TEXT[]);
  END IF;

  SELECT array_agg(DISTINCT s) INTO v_skus
    FROM public.comp_grants cg
    CROSS JOIN LATERAL unnest(cg.scoped_skus) AS s
   WHERE cg.user_id = ANY(v_hosts)
     AND cg.revoked_at IS NULL
     AND (cg.expiry IS NULL OR cg.expiry > NOW())
     AND cg.scope = 'specific_skus';

  RETURN COALESCE(v_skus, ARRAY[]::TEXT[]);
END;
$$;

-- The gates call these from both user (authenticated / anon on public event
-- pages) and service-role (admin) clients, so grant EXECUTE to all three.
-- SECURITY DEFINER bypasses RLS; the body scopes strictly to one event's hosts.
GRANT EXECUTE ON FUNCTION public.event_has_comp_for_sku(UUID, TEXT)
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.event_comp_active_skus(UUID)
  TO authenticated, anon, service_role;

COMMIT;
