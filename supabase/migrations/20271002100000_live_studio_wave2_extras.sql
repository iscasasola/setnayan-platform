-- live_studio_wave2_extras — the ₱0 BROADCAST-EXTRAS wave for the unified Live
-- Studio controller (owner-locked 2026-07-25; Live_Studio_Unified_Spec_2026-07-25.md
-- § 4b "Wave 2 — the ₱0 broadcast-extras wave").
--
-- Wave 1 (migration 20271001100000) landed the switching core: Channel 1 + the
-- camera-channel grid + the cut. Wave 2 adds the things that ride ON the broadcast
-- at zero marginal cost — composited as DOM layers on the surface the couple's
-- encoder already captures, never on a server mixer:
--
--   1. live_studio_overlay_settings — per-event overlay state: the Ⓜ monogram bug
--      (repositionable, default UPPER-RIGHT), the news-style lower third (host's
--      own two lines), and the event-QR "scan to join" code.
--   2. live_studio_highlights      — the ⚡ button's output: a timestamped moment
--      row and NOTHING else. No video is touched, cut, or re-encoded; these become
--      the post-event highlight list (and later YouTube VOD chapters).
--   3. events.live_studio_guest_pick_enabled — guest-pick becomes a REAL toggle
--      (owner: "make it optional"). Wave 1 rendered it read-only precisely because
--      nothing persisted it.
--
-- FREE vs PAID lives in CODE, not in this schema (lib/live-studio-overlays.ts →
-- resolveOverlays, plus requireLiveStudioOwned in the server actions). Two owner
-- locks that the resolver — not the DB — enforces:
--   • the event-QR overlay is FREE (a scan-to-join code pulls guests into the event
--     and grows Setnayan, so it is not behind the ₱2,999);
--   • "POWERED BY SETNAYAN" is a PERMANENT lower third on the free tier — a free
--     host cannot switch it off, and the paid unlock replaces it with the couple's
--     own. Storing it as a row would make it deletable; deriving it from the
--     entitlement makes it un-removable by construction.
-- So a stale `monogram_enabled = true` left behind by a LAPSED entitlement renders
-- nothing: the resolver re-asks the entitlement on every render.
--
-- Everything stays flag-dark behind NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED — nothing
-- reads these objects until the (flag-gated) controller, viewer and program surface.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS · ADD COLUMN IF NOT EXISTS ·
-- DROP POLICY IF EXISTS ; CREATE POLICY. RLS enabled in the SAME migration as the
-- CREATE TABLE (canonical rule).

-- ============================================================================
-- 1. live_studio_overlay_settings — one row per event; the host's overlay state.
--    Control-plane only: no secrets, no stream keys. Couple + coordinator + admin
--    RLS (the same policy shape as live_studio_roam_zones, migration
--    20270919193341). The public event page NEVER reads this table — overlays are
--    composited at the encoding point, not on the viewer's page.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.live_studio_overlay_settings (
  event_id             uuid PRIMARY KEY REFERENCES public.events(event_id) ON DELETE CASCADE,

  -- Ⓜ monogram bug. Repositionable (owner 2026-07-25: "tap/drag to place it"),
  -- default UPPER-RIGHT — the corner a broadcast bug conventionally lives in.
  monogram_enabled     boolean NOT NULL DEFAULT false,
  monogram_position    text    NOT NULL DEFAULT 'top-right'
                         CHECK (monogram_position IN ('top-right','bottom-right','bottom-left','top-center')),

  -- News-style lower third. Two host-editable lines: a title (the couple) and a
  -- subtitle (what is happening right now). Text is normalized + length-capped in
  -- code (lib/live-studio-overlays.ts) so the bar cannot overflow the frame.
  lower_third_enabled  boolean NOT NULL DEFAULT false,
  lower_third_title    text,
  lower_third_subtitle text,

  -- Event-QR "scan to join" overlay. FREE for every host (owner-locked) — the one
  -- overlay that is NOT behind the ₱2,999 unlock.
  event_qr_enabled     boolean NOT NULL DEFAULT false,
  event_qr_position    text    NOT NULL DEFAULT 'top-left'
                         CHECK (event_qr_position IN ('top-left','top-right','bottom-left','bottom-right')),

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_studio_overlay_settings ADD COLUMN IF NOT EXISTS monogram_enabled     boolean NOT NULL DEFAULT false;
ALTER TABLE public.live_studio_overlay_settings ADD COLUMN IF NOT EXISTS monogram_position    text    NOT NULL DEFAULT 'top-right';
ALTER TABLE public.live_studio_overlay_settings ADD COLUMN IF NOT EXISTS lower_third_enabled  boolean NOT NULL DEFAULT false;
ALTER TABLE public.live_studio_overlay_settings ADD COLUMN IF NOT EXISTS lower_third_title    text;
ALTER TABLE public.live_studio_overlay_settings ADD COLUMN IF NOT EXISTS lower_third_subtitle text;
ALTER TABLE public.live_studio_overlay_settings ADD COLUMN IF NOT EXISTS event_qr_enabled     boolean NOT NULL DEFAULT false;
ALTER TABLE public.live_studio_overlay_settings ADD COLUMN IF NOT EXISTS event_qr_position    text    NOT NULL DEFAULT 'top-left';
ALTER TABLE public.live_studio_overlay_settings ADD COLUMN IF NOT EXISTS created_at           timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.live_studio_overlay_settings ADD COLUMN IF NOT EXISTS updated_at           timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.live_studio_overlay_settings ENABLE ROW LEVEL SECURITY;

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
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = live_studio_overlay_settings.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  );

COMMENT ON TABLE public.live_studio_overlay_settings IS
  'Unified Live Studio Wave 2: per-event broadcast-overlay state (monogram bug + position, lower third + text, event-QR + position). Composited client-side at the encoding point — no server mixer, ₱0. FREE-vs-PAID is resolved in code (lib/live-studio-overlays.ts resolveOverlays + requireLiveStudioOwned), never stored here: the event-QR overlay is free, and the free tier''s "POWERED BY SETNAYAN" lower third is DERIVED from the entitlement so a free host cannot delete it. Couple + coordinator + admin RLS.';

COMMENT ON COLUMN public.live_studio_overlay_settings.event_qr_enabled IS
  'Event-QR "scan to join" overlay. FREE for every host (owner-locked 2026-07-25) — deliberately NOT behind the LIVE_STUDIO unlock, because a scan-to-join code on the broadcast pulls guests into the event and grows Setnayan.';

-- ============================================================================
-- 2. live_studio_highlights — the ⚡ button's output. PURE METADATA: one row per
--    tap, carrying when it happened and what was on air. No video processing, no
--    render job, no R2 object — which is exactly why this costs ₱0 and can ship
--    before the streaming transport does.
--
--    `offset_seconds` is stamped at mark time from the active broadcast's
--    went_live_at, so the post-event list can become YouTube VOD chapters without
--    re-deriving anything from a clock we no longer trust.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.live_studio_highlights (
  id             bigserial PRIMARY KEY,
  event_id       uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  marked_at      timestamptz NOT NULL DEFAULT now(),
  -- Seconds since the broadcast went live. NULL when the broadcast start is
  -- unknown — honest absence beats a fabricated 0.
  offset_seconds int,
  -- Which channel Channel 1 was carrying, in the host's own words, AT THAT MOMENT.
  -- Denormalized on purpose: renaming or deleting a camera later must not rewrite
  -- history, so this is a snapshot, not a join.
  channel        int,
  channel_label  text,
  -- Optional host note ("The kiss"). NULL is fine — the tap is the point.
  label          text,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_studio_highlights ADD COLUMN IF NOT EXISTS marked_at      timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.live_studio_highlights ADD COLUMN IF NOT EXISTS offset_seconds int;
ALTER TABLE public.live_studio_highlights ADD COLUMN IF NOT EXISTS channel        int;
ALTER TABLE public.live_studio_highlights ADD COLUMN IF NOT EXISTS channel_label  text;
ALTER TABLE public.live_studio_highlights ADD COLUMN IF NOT EXISTS label          text;
ALTER TABLE public.live_studio_highlights ADD COLUMN IF NOT EXISTS created_by     uuid;
ALTER TABLE public.live_studio_highlights ADD COLUMN IF NOT EXISTS created_at     timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS live_studio_highlights_event_idx
  ON public.live_studio_highlights (event_id, marked_at DESC);

ALTER TABLE public.live_studio_highlights ENABLE ROW LEVEL SECURITY;

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
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = live_studio_highlights.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  );

COMMENT ON TABLE public.live_studio_highlights IS
  'Unified Live Studio Wave 2: ⚡ highlight MOMENTS — one timestamped metadata row per tap while live (offset from went_live_at + a snapshot of the on-air channel). No video is processed, cut or re-encoded; feeds the post-event highlight list and later YouTube VOD chapters. Part of the LIVE_STUDIO unlock (enforced by requireLiveStudioOwned, not by RLS). Distinct from panood_moments, which are director MACRO PRESETS with no timestamp.';

-- ============================================================================
-- 3. events.live_studio_guest_pick_enabled — guest-pick as a REAL toggle.
--
--    Owner-locked 2026-07-25 ("make it optional"): ON = guests may leave Channel 1
--    for any camera channel; OFF = everyone watches the host's cut. DEFAULT TRUE —
--    guest-pick is the differentiator, so it is on the moment multi-camera is
--    unlocked, and the host opts OUT.
--
--    It lands on `events` (not the overlay table) so the PUBLIC page reads it in
--    the same row it already reads live_studio_roam_manifest from — one query, no
--    extra round trip on the wedding page. Existing events RLS covers it.
--
--    ENFORCEMENT IS SERVER-SIDE BY OMISSION: when this is false the loader ships a
--    manifest containing ONLY the on-air channel (lib/live-studio-roam.ts →
--    applyGuestPick), so the other channels' video ids never reach the browser.
--    Hiding a picker while still serialising the ids would be theatre.
-- ============================================================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS live_studio_guest_pick_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.events.live_studio_guest_pick_enabled IS
  'Unified Live Studio Wave 2: may guests switch away from Channel 1 to any camera channel? Host-controlled, default TRUE (on as soon as multi-camera is unlocked). When false the public loader reduces the manifest to the on-air channel only, so other channels'' video ids are never sent to the browser. lib/live-studio-roam.ts applyGuestPick.';
