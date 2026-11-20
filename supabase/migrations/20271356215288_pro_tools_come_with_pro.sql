-- ============================================================================
-- pro_tools_come_with_pro — the photo challenge and the 3D booth come with Pro and up (owner 20 Nov 2026)
--
-- ⚖ DECISION_LOG 2026-11-20 "SUPPLIER AI CHATBOT, 3D BOOTH AND PHOTO CHALLENGE ARE INCLUDED IN PRO AND UP, NOT SOLD
--   AS ADD-ONS" (specs 6c891356). Owner, verbatim: *"the AI chatbot / the 3D booth / the photo challenge this is part
--   of Pro and Up"*. The row left one point open — may Free · Verified · Plus still have them — and the controller
--   closed it 20 Nov under owner delegation: NO, with grandfathering (DECISION_LOG row of the same day).
--
-- WHAT CHANGES
--   1 · `vendor_pro_tools_included(shop, event)` — THE answer for the two tools: a live Pro or Ultra plan, or a
--       shop GRANDFATHERED below (nothing else). The AI chatbot is not here: it has been Pro-and-up in code since
--       2026-11-14 (`PLAN_CHATBOT_LEVEL`, lib/vendor-ai-level.ts), with bought windows running to their end.
--   2 · `vendor_papic_challenge_entitled` and `event_branded_booth_vendor_ids` call it instead of
--       `vendor_specialized_tools_unlocked`. Their legacy arms (a live 28-day photo-challenge window, a paid
--       per-event booth order) are unchanged: paid time is never taken back.
--   3 · `vendor_specialized_tools_unlocked` is NOT changed. The Specialized tools unlock (Plus, the ₱499 window, the
--       trial) keeps opening every OTHER paid tool (custom tools, the Tools Maker, future tools).
--
-- GRANDFATHERING — `vendor_pro_tools_grandfather`, a snapshot taken ONCE, when this file is applied:
--   · a shop on a live Plus plan keeps both tools until the END OF THAT TERM (`plus_term_ends_at`, the
--     `tier_expires_at` it had at apply time). A renewal never shortens it; after it ends, the gate applies.
--     A Plus plan with no end date keeps them while it stays that same open-ended Plus plan.
--   · a live ₱499 / ₱4,990 Specialized tools window keeps them until that window ends.
--   · a claimed first-booking trial keeps them on its event until the trial ends.
--   The snapshot is written only on the FIRST apply: the table's COMMENT is the marker, so a re-apply never
--   grandfathers a shop that joined Plus after this shipped.
--
-- 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md), on the controller's go.
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE / the COMMENT marker.
-- ============================================================================

BEGIN;

-- ── 1 · THE SNAPSHOT ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_pro_tools_grandfather (
  vendor_profile_id UUID PRIMARY KEY
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  plus_term_ends_at TIMESTAMPTZ,
  plus_open_ended   BOOLEAN NOT NULL DEFAULT FALSE,
  unlock_expires_at TIMESTAMPTZ,
  trial_event_id    UUID REFERENCES public.events(event_id) ON DELETE SET NULL,
  trial_ends_at     TIMESTAMPTZ,
  taken_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.vendor_pro_tools_grandfather ENABLE ROW LEVEL SECURITY;

-- RLS on, NO policy and NO grant for anon / authenticated: service_role only (the vendor_specialized_tools_access
-- shape). Every reader is the SECURITY DEFINER gate below.
REVOKE ALL ON public.vendor_pro_tools_grandfather FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.vendor_pro_tools_grandfather TO service_role;

-- Taken only while the table carries no COMMENT (i.e. the first apply).
INSERT INTO public.vendor_pro_tools_grandfather
  (vendor_profile_id, plus_term_ends_at, plus_open_ended, unlock_expires_at, trial_event_id, trial_ends_at)
SELECT
  vp.vendor_profile_id,
  CASE WHEN vp.tier_state::TEXT = 'solo' AND vp.tier_expires_at > NOW() THEN vp.tier_expires_at END,
  (vp.tier_state::TEXT = 'solo' AND vp.tier_expires_at IS NULL),
  CASE WHEN a.unlock_expires_at > NOW() THEN a.unlock_expires_at END,
  CASE WHEN a.trial_ends_at > NOW() THEN a.trial_event_id END,
  CASE WHEN a.trial_ends_at > NOW() THEN a.trial_ends_at END
FROM public.vendor_profiles vp
LEFT JOIN public.vendor_specialized_tools_access a ON a.vendor_profile_id = vp.vendor_profile_id
WHERE obj_description('public.vendor_pro_tools_grandfather'::regclass, 'pg_class') IS NULL
  AND (
    (vp.tier_state::TEXT = 'solo' AND (vp.tier_expires_at IS NULL OR vp.tier_expires_at > NOW()))
    OR a.unlock_expires_at > NOW()
    OR (a.trial_event_id IS NOT NULL AND a.trial_ends_at > NOW())
  )
ON CONFLICT (vendor_profile_id) DO NOTHING;

COMMENT ON TABLE public.vendor_pro_tools_grandfather IS
  'Owner 20 Nov 2026: the photo challenge and the 3D booth come with Pro and up. ONE snapshot, taken when migration 20271356215288 was first applied, of every shop that already had them another way: plus_term_ends_at = the end of the live Plus term then (kept until it ends; a renewal never shortens it), plus_open_ended = a Plus plan with no end date (kept while it stays so), unlock_expires_at = a live Specialized tools window, trial_* = a claimed first-booking trial. Read only by vendor_pro_tools_included(). Never written again: this COMMENT is the marker that stops a re-apply from snapshotting anew. service_role only.';

-- ── 2 · THE ONE ANSWER ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_pro_tools_included(
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
      -- Pro and Ultra include them (owner 20 Nov).
      (vp.tier_state::TEXT IN ('pro', 'enterprise')
         AND (vp.tier_expires_at IS NULL OR vp.tier_expires_at > NOW()))
      -- Grandfathered: the Plus term that was running when this shipped …
      OR (g.plus_term_ends_at IS NOT NULL AND g.plus_term_ends_at > NOW())
      OR (COALESCE(g.plus_open_ended, FALSE) AND vp.tier_state::TEXT = 'solo' AND vp.tier_expires_at IS NULL)
      -- … and a Specialized tools window or trial already held (the unlock's own verified floor, unchanged).
      OR (
        vp.verification_state::TEXT = 'verified'
        AND vp.tier_state::TEXT IN ('verified', 'solo', 'pro', 'enterprise')
        AND (
          (g.unlock_expires_at IS NOT NULL AND g.unlock_expires_at > NOW())
          OR (p_event_id IS NOT NULL
              AND g.trial_event_id = p_event_id
              AND g.trial_ends_at IS NOT NULL
              AND g.trial_ends_at > NOW())
        )
      )
    FROM public.vendor_profiles vp
    LEFT JOIN public.vendor_pro_tools_grandfather g
      ON g.vendor_profile_id = vp.vendor_profile_id
    WHERE vp.vendor_profile_id = p_vendor_profile_id
  ), FALSE);
$$;

COMMENT ON FUNCTION public.vendor_pro_tools_included(UUID, UUID) IS
  'May this shop use the photo challenge and brand its 3D booth at this event? TRUE for a live Pro or Ultra plan (owner 20 Nov 2026: "part of Pro and Up"), or a shop grandfathered in vendor_pro_tools_grandfather (a Plus term, a Specialized tools window or a trial that was running when this shipped, until it ends). Called by vendor_papic_challenge_entitled and event_branded_booth_vendor_ids. Mirror: proToolsIncludedFrom (apps/web/lib/specialized-tools-access.ts). service_role only.';

REVOKE ALL ON FUNCTION public.vendor_pro_tools_included(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_pro_tools_included(UUID, UUID) TO service_role;

-- ── 3 · THE PHOTO CHALLENGE ─────────────────────────────────────────────────
-- Body from 20271331982978; ONE change: the second arm asks vendor_pro_tools_included.
CREATE OR REPLACE FUNCTION public.vendor_papic_challenge_entitled(
  p_vendor_profile_id UUID,
  p_event_id          UUID
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- (1) a live legacy 28-day subscription — retired 2026-11-09, but time already paid for runs to its end;
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
     WHERE vp.vendor_profile_id = p_vendor_profile_id
       AND vp.papic_challenge_expires_at IS NOT NULL
       AND vp.papic_challenge_expires_at > NOW()
  )
  -- (2) ⟵ CHANGED (owner 20 Nov): Pro and up, or grandfathered.
  OR public.vendor_pro_tools_included(p_vendor_profile_id, p_event_id);
$$;

COMMENT ON FUNCTION public.vendor_papic_challenge_entitled(UUID, UUID) IS
  'May this shop run a Papic Challenge at this event? TRUE for a live legacy 28-day subscription (vendor_profiles.papic_challenge_expires_at — paid time honoured to its end) OR vendor_pro_tools_included (Pro and up since owner 20 Nov 2026, or grandfathered). THE SINGLE definition — called by papic_create_vendor_challenge (authoring) and papic_vendor_challenge_photos (delivery). If you replace either caller, keep the call.';

-- ── 4 · THE 3D BOOTH ────────────────────────────────────────────────────────
-- Body from 20271331982978; ONE change: the second arm asks vendor_pro_tools_included.
CREATE OR REPLACE FUNCTION public.event_branded_booth_vendor_ids(p_event_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT x.vendor_profile_id FROM (
    SELECT o.vendor_profile_id
    FROM public.orders o
    WHERE o.event_id = p_event_id
      AND o.service_key = 'vendor_3d_booth_event'
      AND o.status IN ('paid', 'fulfilled')
      AND o.vendor_profile_id IS NOT NULL
    UNION
    -- ⟵ CHANGED (owner 20 Nov): a booked shop on Pro and up, or grandfathered.
    SELECT ev.marketplace_vendor_id
    FROM public.event_vendors ev
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id IS NOT NULL
      AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
      AND ev.archived_at IS NULL
      AND public.vendor_pro_tools_included(ev.marketplace_vendor_id, p_event_id)
  ) x
  WHERE (
      public.is_admin()
      OR p_event_id IN (SELECT public.current_event_ids())
      OR auth.role() = 'service_role'
    );
$$;

COMMENT ON FUNCTION public.event_branded_booth_vendor_ids(UUID) IS
  'Which vendors brand their 3D booth at this event beyond the legacy 28-day window: a PAID per-event 3D Booth order (orders.service_key = vendor_3d_booth_event, retired 2026-11-09, paid orders honoured) OR a booked shop for which vendor_pro_tools_included is true (Pro and up since owner 20 Nov 2026, or grandfathered). The other half of lib/seating-3d boothIsBranded is vendor_profiles.booth_addon_expires_at. service_role ONLY — read server-side by lib/seating.ts fetchBooths via its brandedReader. Ids only — never amounts.';

REVOKE ALL ON FUNCTION public.event_branded_booth_vendor_ids(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_branded_booth_vendor_ids(UUID) TO service_role;

-- ── 5 · THE UNLOCK'S OWN WORDS ──────────────────────────────────────────────
-- Body unchanged; only what it now opens is re-worded.
COMMENT ON FUNCTION public.vendor_specialized_tools_unlocked(UUID, UUID) IS
  'May this shop use the PAID specialized tools (custom tools, the Tools Maker, every future tool) at this event? TRUE for (a) a live paid Specialized tools window on a verified Verified-and-up shop, (b) a live Plus, Pro or Ultra plan, or (c) the one-time first-booked-event trial on THAT event until it ends. Since owner 20 Nov 2026 the photo challenge and the 3D booth are NOT opened by this: they come with Pro and up (vendor_pro_tools_included). The FREE tools never call this. Mirror: specializedToolsUnlockFrom (apps/web/lib/specialized-tools-access.ts). service_role only.';

COMMIT;
