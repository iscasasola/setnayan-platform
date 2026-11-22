-- special_tools_pro_and_ultra_only
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 🧰 SPECIALIZED TOOLS COME WITH PRO AND ULTRA ONLY — PLUS NO LONGER INCLUDES THEM.
-- DECISION_LOG 2026-11-21 "SPECIAL TOOLS ARE INCLUDED IN SUPPLIER PRO AND UP" (owner, verbatim: *"Yes, Pro and up"*)
-- and 2026-11-22 "CORRECTION — THERE IS NO MAX PLAN; SPECIAL TOOLS = PRO AND ULTRA" (tier keys `pro`, `enterprise`;
-- `solo` / Plus dropped). This undoes ONLY section 5 of 20271346711828 ("Specialized tools are included from Plus").
--
-- ONE function, ONE change: arm (b)'s plan list ('solo', 'pro', 'enterprise') → ('pro', 'enterprise'). Everything
-- else is VERBATIM from 20271346711828 (the body prod runs today — checked with pg_get_functiondef on 2026-11-22):
--   · (a) a paid window already held still runs to its end, on a verified Verified-and-up shop (Plus included);
--   · (c) the first-booked-event trial still counts on its own event;
--   · same signature, same SECURITY DEFINER, same search_path, same grants (service_role only).
-- No table, column, price or row is touched. `vendor_pro_tools_included` (20271356215288 — the photo challenge and the
-- 3D booth, with its own grandfathering) is NOT changed.
--
-- WHO THIS MOVES: a live Plus shop with no paid window loses the plan arm. Measured on prod, 2026-11-22
-- (`select tier_state, count(*) from vendor_profiles group by 1`): ZERO shops are on `solo`, so nobody holds it today.
-- Re-measure before the pipeline applies this; a non-zero count is a question for the owner, not for this file.
--
-- Mirror: `SPECIALIZED_TOOLS_INCLUDED_TIERS` + `specializedToolsUnlockFrom` (apps/web/lib/specialized-tools-access.ts),
-- held in step by tests/db/specialized-tools-unlock.db.test.ts (2b, 2f).

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.vendor_specialized_tools_unlocked(
  p_vendor_profile_id UUID,
  p_event_id          UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT
      -- (b) Pro and Ultra include it (owner 2026-11-09; Plus was added 2026-11-14 and dropped 2026-11-21/22).
      (vp.tier_state::TEXT IN ('pro', 'enterprise')
         AND (vp.tier_expires_at IS NULL OR vp.tier_expires_at > NOW()))
      OR (
        vp.verification_state::TEXT = 'verified'
        AND vp.tier_state::TEXT IN ('verified', 'solo', 'pro', 'enterprise')
        AND (
          -- (a) a live paid window.
          (a.unlock_expires_at IS NOT NULL AND a.unlock_expires_at > NOW())
          -- (c) the trial, on its event, until it ends.
          OR (p_event_id IS NOT NULL
              AND a.trial_event_id = p_event_id
              AND a.trial_ends_at IS NOT NULL
              AND a.trial_ends_at > NOW())
        )
      )
    FROM public.vendor_profiles vp
    LEFT JOIN public.vendor_specialized_tools_access a
      ON a.vendor_profile_id = vp.vendor_profile_id
    WHERE vp.vendor_profile_id = p_vendor_profile_id
  ), FALSE);
$$;

COMMENT ON FUNCTION public.vendor_specialized_tools_unlocked(UUID, UUID) IS
  'May this shop use the PAID specialized tools at this event? TRUE for (a) a live paid Specialized tools window on a verified Verified-and-up shop (no longer sold since 2026-11-14 — a bought window runs to its end), (b) a live Pro or Ultra plan (included: owner 2026-11-09; Plus was included 2026-11-14 → 2026-11-22 and is not any more), or (c) the one-time first-booked-event trial on THAT event until it ends. The FREE tools never call this; the photo challenge and the 3D booth read vendor_pro_tools_included(). Mirror: specializedToolsUnlockFrom (apps/web/lib/specialized-tools-access.ts). service_role only; the SECURITY DEFINER gates that call it run as the owner.';

REVOKE ALL ON FUNCTION public.vendor_specialized_tools_unlocked(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_specialized_tools_unlocked(UUID, UUID) TO service_role;

COMMIT;
