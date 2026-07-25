-- live_studio_moderator_control_access
--
-- ⭐ WAVE 7 · THE COORDINATOR ACCESS REGRESSION
-- (Live_Studio_Unified_Spec_2026-07-25.md § 4f ④ · found by Wave 6's cutover audit.)
--
-- ── THE BUG, IN ONE SENTENCE ────────────────────────────────────────────────
-- A coordinator invited through `event_moderators` reaches the unified Live Studio
-- controller and sees an EMPTY CHANNEL GRID.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Setnayan has TWO membership notions and this is where they diverge:
--
--   • `event_moderators` — the invite-and-accept relationship a couple actually
--     uses to hand someone the day-of controls. The LEGACY Cast control room
--     admits it (requirePanoodControlRoomMember), and reads its control plane with
--     the SERVICE-ROLE client precisely so the moderator sees anything at all — the
--     comment in broadcast/page.tsx says so in as many words.
--   • `event_members.member_type` — the older row these three tables' RLS keys off
--     (`IN ('couple','coordinator')`). A moderator-invited coordinator often has NO
--     such row.
--
-- The unified controller reads `live_studio_roam_zones` with the SESSION client, so
-- the database quietly returns zero rows: no error, no forbidden, no empty-state
-- explanation — just a controller with no cameras in it. And because the writes go
-- through the same session client, "add a channel" and "cut to CH 1" would fail the
-- WITH CHECK too. The page gate (isLiveStudioSetupHost) already says yes; only the
-- database says no.
--
-- That matters more than a normal empty grid: "a friend or a coordinator runs the
-- controller" IS the no-crew pitch. The person the product is designed around is
-- exactly the person it locks out.
--
-- ── THE FIX, AND WHY IT IS RLS RATHER THAN THE READ PATH ────────────────────
-- Reading zones through the service-role client (what the legacy room does) would
-- fix the GRID and leave every WRITE broken, because the server actions use the
-- session client. Two half-fixes in two files, with the drift that produced this
-- bug still in place. Instead the policies are taught the same membership the app
-- already accepts, in ONE place, for read and write together.
--
-- ── DOES THIS WIDEN ACCESS? NO — IT RESTORES PARITY. ────────────────────────
-- The added branch is the canonical, repo-wide moderator predicate: a row in
-- `event_moderators` for THIS event, `accepted_at IS NOT NULL` (they accepted the
-- invitation) and `removed_at IS NULL` (the couple has not revoked it). Same shape
-- as event_sponsors, vendor_meetings, event_manual_vendors and a dozen others.
--
--   • It admits ONLY people the couple explicitly invited and who accepted.
--   • Revocation is immediate — clearing `removed_at IS NULL` closes the door on
--     the next query, with no cache and no session to expire.
--   • It admits NO guest, NO vendor, NO other couple, and nobody anonymous. RLS
--     stays scoped to `authenticated`.
--   • The LEGACY control room ALREADY grants this exact set full control of the
--     same event's broadcast. This is the set that was always meant to be here.
--
-- Applied to all THREE control-plane tables the unified controller touches under
-- the host's own session, because fixing one and not the others just moves the
-- empty screen: the grid would fill and then the monogram would refuse to save.
--
-- KEEP IDEMPOTENT: DROP POLICY IF EXISTS ; CREATE POLICY.

-- ============================================================================
-- 1. live_studio_roam_zones — the camera channels (THE empty grid).
-- ============================================================================
DROP POLICY IF EXISTS live_studio_roam_zones_couple_full ON public.live_studio_roam_zones;
CREATE POLICY live_studio_roam_zones_couple_full ON public.live_studio_roam_zones
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = live_studio_roam_zones.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
    OR EXISTS (
      SELECT 1 FROM public.event_moderators mo
      WHERE mo.event_id = live_studio_roam_zones.event_id
        AND mo.user_id = auth.uid()
        AND mo.accepted_at IS NOT NULL
        AND mo.removed_at IS NULL
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = live_studio_roam_zones.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
    OR EXISTS (
      SELECT 1 FROM public.event_moderators mo
      WHERE mo.event_id = live_studio_roam_zones.event_id
        AND mo.user_id = auth.uid()
        AND mo.accepted_at IS NOT NULL
        AND mo.removed_at IS NULL
    )
  );

COMMENT ON TABLE public.live_studio_roam_zones IS
  'Live Studio ROAM: the "places" a guest can visit (one per camera/zone/venue). Control-room RLS — couple + coordinator (event_members) + accepted, non-removed moderators (event_moderators), NOT guests. Public picker reads the mirrored events.live_studio_roam_manifest. lib/live-studio-roam.ts.';

-- ============================================================================
-- 2. live_studio_overlay_settings — monogram / lower third / event QR placement.
-- ============================================================================
DROP POLICY IF EXISTS live_studio_overlay_settings_couple_full ON public.live_studio_overlay_settings;
CREATE POLICY live_studio_overlay_settings_couple_full ON public.live_studio_overlay_settings
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = live_studio_overlay_settings.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
    OR EXISTS (
      SELECT 1 FROM public.event_moderators mo
      WHERE mo.event_id = live_studio_overlay_settings.event_id
        AND mo.user_id = auth.uid()
        AND mo.accepted_at IS NOT NULL
        AND mo.removed_at IS NULL
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = live_studio_overlay_settings.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
    OR EXISTS (
      SELECT 1 FROM public.event_moderators mo
      WHERE mo.event_id = live_studio_overlay_settings.event_id
        AND mo.user_id = auth.uid()
        AND mo.accepted_at IS NOT NULL
        AND mo.removed_at IS NULL
    )
  );

-- ============================================================================
-- 3. live_studio_highlights — the ⚡ moment timestamps marked during the show.
--    The most operator-shaped of the three: marking moments IS the job the
--    couple handed to whoever is running the controller.
-- ============================================================================
DROP POLICY IF EXISTS live_studio_highlights_couple_full ON public.live_studio_highlights;
CREATE POLICY live_studio_highlights_couple_full ON public.live_studio_highlights
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = live_studio_highlights.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
    OR EXISTS (
      SELECT 1 FROM public.event_moderators mo
      WHERE mo.event_id = live_studio_highlights.event_id
        AND mo.user_id = auth.uid()
        AND mo.accepted_at IS NOT NULL
        AND mo.removed_at IS NULL
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = live_studio_highlights.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
    OR EXISTS (
      SELECT 1 FROM public.event_moderators mo
      WHERE mo.event_id = live_studio_highlights.event_id
        AND mo.user_id = auth.uid()
        AND mo.accepted_at IS NOT NULL
        AND mo.removed_at IS NULL
    )
  );

-- ============================================================================
-- ⚠ DELIBERATELY NOT WIDENED HERE
--
--   • `orders` stays purchaser-scoped (orders_owner_read: user_id = auth.uid()).
--     A coordinator has no business reading the couple's payment history, and the
--     controller does not need them to: its entitlement + broadcast-day reads run
--     through the SERVICE-ROLE client behind the host gate (the same posture the
--     Wave 5 program pop-out already uses, and the reason a coordinator is not
--     silently downgraded to one camera mid-wedding).
--   • `panood_camera_operators` keeps its control-room-only RLS. Its rows carry
--     `claim_qr_token`, a per-seat hijack credential, and the controller already
--     reads those through the service role behind the host gate. Opening that
--     table to a session client would put a live credential one PostgREST call
--     away from anyone the couple ever invited.
-- ============================================================================
