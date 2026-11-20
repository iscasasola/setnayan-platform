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
-- GRANDFATHERING — three columns on vendor_specialized_tools_access, frozen ONCE when this file is applied:
--   · pro_tools_plus_until: a live Plus term keeps both tools until the END OF THAT TERM (a renewal never shortens it);
--     'infinity' = a Plus plan with no end date, kept while it stays that same open-ended Plus plan.
--   · pro_tools_unlock_until: a live ₱499 / ₱4,990 Specialized tools window keeps them until that window ends.
--   · pro_tools_trial_until: a claimed first-booking trial keeps them on its event until the trial ends.
--   The snapshot writes only on the FIRST apply: pro_tools_plus_until's COMMENT is the marker, so a re-apply never
--   grandfathers a shop that joined Plus after this shipped.
--
-- 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md), on the controller's go.
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT / the COMMENT marker.
-- ============================================================================

BEGIN;

-- ── 1 · THE SNAPSHOT ────────────────────────────────────────────────────────
-- Three columns on the shop's existing Specialized tools row, frozen once (NULL = held nothing that way at ship time):
--   pro_tools_plus_until   — the end of the Plus term running then; 'infinity' = a Plus plan with no end date
--   pro_tools_unlock_until — the end of the Specialized tools window running then
--   pro_tools_trial_until  — the end of the claimed trial running then (on trial_event_id, which never changes once set)
ALTER TABLE public.vendor_specialized_tools_access
  ADD COLUMN IF NOT EXISTS pro_tools_plus_until   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pro_tools_unlock_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pro_tools_trial_until  TIMESTAMPTZ;

-- Taken only while pro_tools_plus_until carries no COMMENT, i.e. on the first apply (the COMMENT is set right after).
INSERT INTO public.vendor_specialized_tools_access
  (vendor_profile_id, pro_tools_plus_until, pro_tools_unlock_until, pro_tools_trial_until)
SELECT
  vp.vendor_profile_id,
  CASE WHEN vp.tier_state::TEXT = 'solo' AND vp.tier_expires_at IS NULL THEN 'infinity'::TIMESTAMPTZ
       WHEN vp.tier_state::TEXT = 'solo' AND vp.tier_expires_at > NOW() THEN vp.tier_expires_at END,
  CASE WHEN a.unlock_expires_at > NOW() THEN a.unlock_expires_at END,
  CASE WHEN a.trial_event_id IS NOT NULL AND a.trial_ends_at > NOW() THEN a.trial_ends_at END
FROM public.vendor_profiles vp
LEFT JOIN public.vendor_specialized_tools_access a ON a.vendor_profile_id = vp.vendor_profile_id
WHERE col_description('public.vendor_specialized_tools_access'::regclass,
        (SELECT attnum FROM pg_attribute
          WHERE attrelid = 'public.vendor_specialized_tools_access'::regclass AND attname = 'pro_tools_plus_until')) IS NULL
  AND (
    (vp.tier_state::TEXT = 'solo' AND (vp.tier_expires_at IS NULL OR vp.tier_expires_at > NOW()))
    OR a.unlock_expires_at > NOW()
    OR (a.trial_event_id IS NOT NULL AND a.trial_ends_at > NOW())
  )
ON CONFLICT (vendor_profile_id) DO UPDATE SET
  pro_tools_plus_until   = EXCLUDED.pro_tools_plus_until,
  pro_tools_unlock_until = EXCLUDED.pro_tools_unlock_until,
  pro_tools_trial_until  = EXCLUDED.pro_tools_trial_until;

COMMENT ON COLUMN public.vendor_specialized_tools_access.pro_tools_plus_until IS
  'Owner 20 Nov 2026: the photo challenge and the 3D booth come with Pro and up. GRANDFATHER, frozen once when migration 20271356215288 was first applied: the end of the Plus term then running (kept until it ends; a renewal never shortens it), or ''infinity'' for a Plus plan with no end date (kept while it stays so). This COMMENT is the marker that stops a re-apply from snapshotting anew. Read only by vendor_pro_tools_included().';
COMMENT ON COLUMN public.vendor_specialized_tools_access.pro_tools_unlock_until IS
  'GRANDFATHER (owner 20 Nov 2026), frozen once: the end of the Specialized tools window running when 20271356215288 was applied — the photo challenge and the 3D booth stay open until then. Read only by vendor_pro_tools_included().';
COMMENT ON COLUMN public.vendor_specialized_tools_access.pro_tools_trial_until IS
  'GRANDFATHER (owner 20 Nov 2026), frozen once: the end of the trial (on trial_event_id) that was running when 20271356215288 was applied. Read only by vendor_pro_tools_included().';

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
      OR (g.pro_tools_plus_until IS NOT NULL AND g.pro_tools_plus_until <> 'infinity'::TIMESTAMPTZ
          AND g.pro_tools_plus_until > NOW())
      OR (g.pro_tools_plus_until = 'infinity'::TIMESTAMPTZ
          AND vp.tier_state::TEXT = 'solo' AND vp.tier_expires_at IS NULL)
      -- … and a Specialized tools window or trial already held (the unlock's own verified floor, unchanged).
      OR (
        vp.verification_state::TEXT = 'verified'
        AND vp.tier_state::TEXT IN ('verified', 'solo', 'pro', 'enterprise')
        AND (
          (g.pro_tools_unlock_until IS NOT NULL AND g.pro_tools_unlock_until > NOW())
          OR (p_event_id IS NOT NULL
              AND g.trial_event_id = p_event_id
              AND g.pro_tools_trial_until IS NOT NULL
              AND g.pro_tools_trial_until > NOW())
        )
      )
    FROM public.vendor_profiles vp
    LEFT JOIN public.vendor_specialized_tools_access g
      ON g.vendor_profile_id = vp.vendor_profile_id
    WHERE vp.vendor_profile_id = p_vendor_profile_id
  ), FALSE);
$$;

COMMENT ON FUNCTION public.vendor_pro_tools_included(UUID, UUID) IS
  'May this shop use the photo challenge and brand its 3D booth at this event? TRUE for a live Pro or Ultra plan (owner 20 Nov 2026: "part of Pro and Up"), or a shop grandfathered by the frozen vendor_specialized_tools_access.pro_tools_* columns (a Plus term, a Specialized tools window or a trial that was running when this shipped, until it ends). Called by vendor_papic_challenge_entitled and event_branded_booth_vendor_ids. Mirror: proToolsIncludedFrom (apps/web/lib/specialized-tools-access.ts). service_role only.';

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
