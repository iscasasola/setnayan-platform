-- panood_screens — the VENUE-SCREEN data layer for the upgraded Panood multicam
-- controller (iteration 0011). A PERSISTENT, NAMED multi-screen registry: one row
-- per physical display (TV / LED wall / projector / stick) the couple registers
-- for an event. The controller routes a source/mode to each screen independently
-- (photos / mirror / live_bg / a camera feed / off).
--
-- This is DISTINCT from the transient public.wall_display_sessions (migration
-- 20261104000959): that table is a short-lived (15-minute) claim handshake that
-- mints a display JWT and is thrown away. panood_screens is the durable registry
-- of the screens themselves — it survives across the event, holds the routed
-- source, and the named/indexed identity the control room manages.
--
-- PAIRING — a screen device (a TV / stick / projector) TYPES a short code rather
-- than scanning a long token, so we reuse the wall_display_sessions.display_code
-- idea: a 6-char Crockford pairing_code printed beside a QR. (Contrast with the
-- camera operators in 20270227010000, where a PHONE scans a long unguessable
-- claim_qr_token.) The actual pair/claim handshake runs through a SECURITY DEFINER
-- RPC / the service-role admin client in a later PR.
--
-- KEEP THIS MIGRATION IDEMPOTENT (mirrors panood_camera_operators conventions —
-- it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS public.panood_screens (
  id                 bigserial PRIMARY KEY,
  event_id           uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  screen_index       int NOT NULL,
    -- Dense 1..N per event. The control-room "Screen 1 / Screen 2 / …" label and
    -- the multi-screen wall layout order both derive from this.
  name               text,
    -- Optional couple-set name, e.g. "Main stage LED" / "Lobby TV".
  pairing_code       text,
    -- The short 6-char Crockford code a screen DEVICE enters/scans to pair.
    -- Printed beside a QR (reuses the wall_display_sessions.display_code idea — a
    -- TV/stick types a short code, unlike a phone scanning a long token). Rotates
    -- on revoke / re-issue. NULL once paired or when no pairing is pending.
  pairing_expires_at timestamptz,
    -- When the current pairing_code stops being accepted (mints a fresh one).
  paired_at          timestamptz,
    -- When a device successfully paired to this screen. NULL until paired.
  current_source     text NOT NULL DEFAULT 'photos',
    -- The routed source/mode for this screen: photos | mirror | live_bg | off |
    -- cam1 | cam2 | … — loose text on purpose, sources are dynamic (camera count
    -- and modes vary per event), so NO CHECK constraint here.
  status             text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','online','offline')),
    -- pending — registered, not yet paired/seen
    -- online  — paired device with a recent heartbeat
    -- offline — paired but no recent heartbeat
  last_seen_at       timestamptz,
    -- Heartbeat from the paired screen device; drives online/offline.
  revoked_at         timestamptz,
    -- Couple can revoke a screen and reissue a fresh pairing_code.
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, screen_index)
);

-- Defensive ADD COLUMN IF NOT EXISTS for fresh-DB reproducibility — a no-op when
-- the CREATE TABLE above just ran, but keeps the schema correct if an older
-- partial table already exists (mirrors panood_camera_operators).
ALTER TABLE public.panood_screens ADD COLUMN IF NOT EXISTS event_id           uuid;
ALTER TABLE public.panood_screens ADD COLUMN IF NOT EXISTS screen_index       int;
ALTER TABLE public.panood_screens ADD COLUMN IF NOT EXISTS name               text;
ALTER TABLE public.panood_screens ADD COLUMN IF NOT EXISTS pairing_code       text;
ALTER TABLE public.panood_screens ADD COLUMN IF NOT EXISTS pairing_expires_at timestamptz;
ALTER TABLE public.panood_screens ADD COLUMN IF NOT EXISTS paired_at          timestamptz;
ALTER TABLE public.panood_screens ADD COLUMN IF NOT EXISTS current_source     text NOT NULL DEFAULT 'photos';
ALTER TABLE public.panood_screens ADD COLUMN IF NOT EXISTS status             text NOT NULL DEFAULT 'pending';
ALTER TABLE public.panood_screens ADD COLUMN IF NOT EXISTS last_seen_at       timestamptz;
ALTER TABLE public.panood_screens ADD COLUMN IF NOT EXISTS revoked_at         timestamptz;
ALTER TABLE public.panood_screens ADD COLUMN IF NOT EXISTS created_at         timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.panood_screens ADD COLUMN IF NOT EXISTS updated_at         timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS panood_screens_event_idx
  ON public.panood_screens (event_id);

-- ---- RLS -------------------------------------------------------------------
-- Enabled at CREATE TABLE time (canonical rule), in the SAME migration.
--
-- Mirrors panood_camera_operators RLS EXACTLY: control scoped to the CONTROL-ROOM
-- roles only — the couple + a coordinator who runs the day-of switcher
-- (member_type IN ('couple','coordinator'), the canonical control scope).
-- Deliberately NOT current_event_ids() (every member, incl. GUESTS) — screen rows
-- hold the pairing_code and the source-routing control plane, which a guest must
-- never read or mutate (least privilege on a control-plane table). The screen
-- pair/claim handshake goes through a SECURITY DEFINER RPC / the service-role
-- admin client in a later PR, so NO anon/device policy is invented here.
ALTER TABLE public.panood_screens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS panood_screens_couple_full ON public.panood_screens;
CREATE POLICY panood_screens_couple_full ON public.panood_screens
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = panood_screens.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = panood_screens.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  );

COMMENT ON TABLE public.panood_screens IS
  'Upgraded Panood multicam: persistent, named per-event VENUE-SCREEN registry (distinct from the transient wall_display_sessions handshake). Dense screen_index, short 6-char Crockford pairing_code (a TV/stick types it, beside a QR), loose-text current_source routing, control-room-scoped RLS (couple + coordinator only, NOT guests); pair/claim runs through a SECURITY DEFINER RPC / admin client. lib/panood-screens.ts.';
