-- retire_patiktok_and_music_maker
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- Owner, 2026-11-20, verbatim: "Retire Patiktok and Music Maker ( we do not want to serve this anymore)".
-- And, the same day (DECISION_LOG "EVENT ULTRA STAYS ₱9,990 WITH PATIKTOK RETIRED"): "Keep ₱9,990" — Ultra
-- loses Patiktok and keeps its price.
--
-- 1 · Two couple products leave sale: PATIKTOK_COMPILER (Patiktok) and PAKANTA (Music Maker).
--     Measured in prod on 2026-11-20 before this was written: ZERO purchases of either
--     (event_software_activations_v2, onboarding_order_items and shop_gift_purchases are all empty for both
--     codes), and zero Event Ultra orders — nobody loses anything.
--     The catalogue's own retirement shape (the admin "Retire" action, and 20271303683629 / 20271310256381):
--     is_active = FALSE · retired_at stamped · retirement_reason quoting the owner. Never DELETE — order rows
--     reference the code. `resolveServiceSellability` reads is_active, so checkout refuses both from here.
--
-- 2 · A gifted Event Ultra no longer confers PATIKTOK_COMPILER. The two gifted-access readers mirror the app's
--     EVENT_ULTRA_GRANTS (lib/event-ultra.ts), which drops PATIKTOK_COMPILER in the same PR; held equal by
--     a-badge-climbs-one-ladder.db.test.ts. Copied from 20271348181787_black_diamond_gives_event_ultra.sql
--     (the latest definition of both); the ONLY change is 'PATIKTOK_COMPILER' leaving the two Ultra lists.

UPDATE public.platform_retail_catalog_v2
   SET is_active         = FALSE,
       retired_at        = COALESCE(retired_at, NOW()),
       retirement_reason = COALESCE(retirement_reason,
         'Owner 2026-11-20: "Retire Patiktok and Music Maker ( we do not want to serve this anymore)". Zero purchases.'),
       updated_at        = NOW()
 WHERE service_code IN ('PATIKTOK_COMPILER', 'PAKANTA')
   AND (is_active OR retired_at IS NULL);

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
  )
  -- 🎁 A supplier's Event Plus / Event Pro gift, given to THIS event (20271319497337).
  OR EXISTS (
    SELECT 1
      FROM public.shop_gift_stock_entries e
     WHERE e.event_id = p_event_id
       AND e.kind = 'given'
       AND (
            e.unlocks_sku = p_service_key
         -- 💎 A gifted Event Ultra confers what an Ultra ORDER confers (EVENT_ULTRA_GRANTS, lib/event-ultra.ts —
         -- held equal by a-badge-climbs-one-ladder.db.test.ts), since comps match a SKU exactly, never by alias.
         OR (e.unlocks_sku = 'EVENT_ULTRA' AND p_service_key IN ('COUPLE_WEBSITE_PRO', 'LIVE_STUDIO'))
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
  v_gifted  TEXT[];
BEGIN
  -- 🎁 A supplier's Event Plus / Event Pro gifts to THIS event (20271319497337) —
  -- read first: they belong to the event, so they need no host.
  SELECT array_agg(DISTINCT e.unlocks_sku) INTO v_gifted
    FROM public.shop_gift_stock_entries e
   WHERE e.event_id = p_event_id
     AND e.kind = 'given'
     AND e.unlocks_sku IS NOT NULL;
  v_gifted := COALESCE(v_gifted, ARRAY[]::TEXT[]);
  -- 💎 A gifted Event Ultra also lists what an Ultra order confers (EVENT_ULTRA_GRANTS, lib/event-ultra.ts).
  IF 'EVENT_ULTRA' = ANY(v_gifted) THEN
    v_gifted := ARRAY(SELECT DISTINCT s FROM unnest(v_gifted || ARRAY['COUPLE_WEBSITE_PRO', 'LIVE_STUDIO']::TEXT[]) AS s);
  END IF;

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
    RETURN v_gifted;
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
    FROM (
      SELECT s
        FROM public.comp_grants cg
        CROSS JOIN LATERAL unnest(cg.scoped_skus) AS s
       WHERE cg.user_id = ANY(v_hosts)
         AND cg.revoked_at IS NULL
         AND (cg.expiry IS NULL OR cg.expiry > NOW())
         AND (cg.event_id IS NULL OR cg.event_id = p_event_id)
         AND cg.scope = 'specific_skus'
      UNION
      SELECT unnest(v_gifted)
    ) x;

  RETURN COALESCE(v_skus, ARRAY[]::TEXT[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.event_has_comp_for_sku(UUID, TEXT)
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.event_comp_active_skus(UUID)
  TO authenticated, anon, service_role;
