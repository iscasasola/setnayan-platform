-- event_hub_pro_keeps_everything_before_19_nov
--
-- 💎 THE 11 EVENT HUB PARTS AND EDITORIAL MOVE FROM EVENT PRO TO EVENT ULTRA, FOR NEW BUYERS ONLY.
-- Owner 18–19 Nov 2026 (specs PLAN_RULINGS_2026-11-18.md 34; DECISION_LOG 2026-11-19 "Event plans part 2 (#8004),
-- four calls", "all your picks"): an Event Pro ordered BEFORE 19 Nov keeps everything it was sold as, and so do a
-- gifted Pro, an admin comp and a bundle or onboarding basket with Pro in it, each by its own date.
--
-- 🔑 A GRANDFATHER, NOT A DATA REWRITE (template: `event_hub_pro_legacy_part_lines`, 20271294362939). No order, comp or
-- gift is touched. For one event this returns the Event Pro lines dated before the cutover, each with its own status,
-- and whether a still-live comp or a supplier gift of Pro was given before it. The APP decides with the same status
-- rule it uses for every gate (`orderStatusConfersAccess` / `orderStatusConfersOwnership`), so a refund still takes it
-- back and a still-submitted order still owns nothing until approved.
--
--   • CUTOVER: 2026-11-18 16:00 UTC = 19 Nov 2026 00:00 PHT, the day of the ruling. Typed HERE because it is a frozen
--              historical fact, never a live setting.
--   • Pro, by its one code `COUPLE_WEBSITE_PRO`: its own order · a bundle whose components include it
--     (`bundle_components`) · an onboarding basket line · an admin comp covering it (all services, or the code) · a
--     supplier's 'given' gift of it. An internal or founder-seat host needs none of this: they hold Event Ultra.
--
-- Service role ONLY, exactly like `event_hub_pro_legacy_part_lines` and `event_entitlement_facts`: the rows are the
-- couple's bill. Any other caller gets NULL, and no EXECUTE grant reaches anon or authenticated.

CREATE OR REPLACE FUNCTION public.event_hub_pro_kept_lines(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_cutover CONSTANT TIMESTAMPTZ := '2026-11-18 16:00:00+00';
  c_pro     CONSTANT TEXT        := 'COUPLE_WEBSITE_PRO';
BEGIN
  IF p_event_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'cutover', c_cutover,
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('status', l.status))
        FROM (
          SELECT o.status::TEXT AS status
            FROM public.orders o
           WHERE o.event_id = p_event_id
             AND o.created_at < c_cutover
             AND (
                  o.service_key = c_pro
               OR o.service_key IN (SELECT b.bundle_sku_code FROM public.bundle_components b WHERE b.component_service_code = c_pro)
             )
          UNION ALL
          SELECT o.status::TEXT
            FROM public.onboarding_order_items i
            JOIN public.orders o ON o.order_id = i.order_id
           WHERE o.event_id = p_event_id
             AND i.service_code = c_pro
             AND o.created_at < c_cutover
        ) l
    ), '[]'::jsonb),
    'granted', (
      EXISTS (
        SELECT 1
          FROM public.comp_grants cg
         WHERE cg.revoked_at IS NULL
           AND (cg.expiry IS NULL OR cg.expiry > NOW())
           AND cg.created_at < c_cutover
           AND (cg.event_id IS NULL OR cg.event_id = p_event_id)
           AND (cg.scope = 'all_services' OR (cg.scope = 'specific_skus' AND c_pro = ANY (cg.scoped_skus)))
           AND cg.user_id IN (
                SELECT em.user_id
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
           )
      )
      OR EXISTS (
        SELECT 1
          FROM public.shop_gift_stock_entries e
         WHERE e.event_id = p_event_id
           AND e.kind = 'given'
           AND e.unlocks_sku = c_pro
           AND e.created_at < c_cutover
      )
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.event_hub_pro_kept_lines(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_hub_pro_kept_lines(UUID) TO service_role;
