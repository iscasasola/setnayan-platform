-- comp_grants_event_scoped
--
-- `comp_grants` is user-scoped only — a grant applies to EVERY event that
-- user hosts, because `event_has_comp_for_sku()` resolves it via
-- `cg.user_id IN (hosts of p_event_id)`, with no per-event filter at all.
-- That's wrong for "comp this couple's SPECIFIC event" (owner request
-- 2026-09-05) once an account has more than one event — a comp meant for
-- their upcoming wedding would just as well unlock their earlier debut.
--
-- Adds a nullable `event_id` on comp_grants: NULL keeps today's behavior
-- (applies to every event the user hosts — fully backward-compatible with
-- every existing row and every existing grant flow that doesn't pass one).
-- Set, it scopes the grant to that ONE event, checked by both entitlement
-- functions in addition to the existing host check — event_id alone is
-- never a bypass of "and this user must actually be a host of it".
--
-- IDEMPOTENT: ADD COLUMN/INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION.

ALTER TABLE public.comp_grants
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(event_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comp_grants_event
  ON public.comp_grants(event_id) WHERE event_id IS NOT NULL;

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
       AND (cg.event_id IS NULL OR cg.event_id = p_event_id)
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
       AND (cg.event_id IS NULL OR cg.event_id = p_event_id)
       AND cg.scope = 'all_services'
  ) INTO v_has_all;

  IF v_has_all THEN
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
     AND (cg.event_id IS NULL OR cg.event_id = p_event_id)
     AND cg.scope = 'specific_skus';

  RETURN COALESCE(v_skus, ARRAY[]::TEXT[]);
END;
$$;
