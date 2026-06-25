-- panood_camera_operators — the CAMERA-OPERATOR data layer for the upgraded
-- Panood multicam controller (iteration 0011). One row per camera "seat" the
-- couple provisions for an event; a designated operator claims the seat via a
-- per-camera QR / link (/panood/cam/[token]) and goes live as one feed in the
-- multicam switcher.
--
-- This is a DIRECT clone of the PROVEN Papic seat-claim pattern
-- (paparazzi_seats, migration 20260520015000): a dense per-event index, a
-- per-seat unguessable claim_qr_token, a claimer binding, and control-room RLS.
-- The login-free claim path (the operator GET → POST claim) will run through a
-- SECURITY DEFINER RPC / the service-role admin client in a later PR — exactly
-- like Papic — so paparazzi_seats-style strict couple-only RLS is correct here.
--
-- KEEP THIS MIGRATION IDEMPOTENT (mirrors panood_broadcasts conventions —
-- it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS public.panood_camera_operators (
  id                bigserial PRIMARY KEY,
  event_id          uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  camera_index      int NOT NULL,
    -- Dense 1..N per event. The operator-facing "Camera 1 / Camera 2 / …" label
    -- and the multicam switcher slot order both derive from this.
  label             text,
    -- Optional couple-set name, e.g. "Stage left" / "Aisle cam".
  claim_qr_token    text NOT NULL,
    -- Per-camera claim token the QR / link carries. Operator scans →
    -- /panood/cam/[token] → SECURITY DEFINER RPC validates + binds (later PR).
    -- Unguessable + unique (see the unique index below).
  claimer_user_id   uuid,
    -- The operator bound to this camera. NULL until claimed. Loose-typed (no FK
    -- to auth.users) because a login-free claim mints a native-anon session via
    -- the admin client, same posture as the Papic login-free seat claim.
  claimed_at        timestamptz,
  last_seen_at      timestamptz,
    -- Heartbeat from the live operator feed; drives the 'live'/'offline' status.
  status            text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','live','offline','revoked')),
  revoked_at        timestamptz,
    -- Couple can revoke a claim and reissue a fresh token (operator dropped out).
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, camera_index)
);

-- Defensive ADD COLUMN IF NOT EXISTS for fresh-DB reproducibility — a no-op
-- when the CREATE TABLE above just ran, but keeps the schema correct if an
-- older partial table already exists (mirrors panood_broadcasts).
ALTER TABLE public.panood_camera_operators ADD COLUMN IF NOT EXISTS event_id        uuid;
ALTER TABLE public.panood_camera_operators ADD COLUMN IF NOT EXISTS camera_index    int;
ALTER TABLE public.panood_camera_operators ADD COLUMN IF NOT EXISTS label           text;
ALTER TABLE public.panood_camera_operators ADD COLUMN IF NOT EXISTS claim_qr_token  text;
ALTER TABLE public.panood_camera_operators ADD COLUMN IF NOT EXISTS claimer_user_id uuid;
ALTER TABLE public.panood_camera_operators ADD COLUMN IF NOT EXISTS claimed_at      timestamptz;
ALTER TABLE public.panood_camera_operators ADD COLUMN IF NOT EXISTS last_seen_at    timestamptz;
ALTER TABLE public.panood_camera_operators ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'open';
ALTER TABLE public.panood_camera_operators ADD COLUMN IF NOT EXISTS revoked_at      timestamptz;
ALTER TABLE public.panood_camera_operators ADD COLUMN IF NOT EXISTS created_at      timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.panood_camera_operators ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();

-- A claim token must be globally unguessable AND unique — it is the only secret
-- guarding the login-free claim route.
CREATE UNIQUE INDEX IF NOT EXISTS panood_camera_operators_claim_qr_token_key
  ON public.panood_camera_operators (claim_qr_token);

CREATE INDEX IF NOT EXISTS panood_camera_operators_event_idx
  ON public.panood_camera_operators (event_id);

-- ---- RLS -------------------------------------------------------------------
-- Enabled at CREATE TABLE time (canonical rule), in the SAME migration.
--
-- Mirrors the paparazzi_seats RLS STRUCTURE (EXISTS on event_members), but
-- scopes control to the CONTROL-ROOM roles only: the couple + a coordinator who
-- runs the day-of switcher (member_type IN ('couple','coordinator'), the
-- canonical control scope). Deliberately NOT current_event_ids() (every member,
-- incl. GUESTS) — camera rows hold the secret claim_qr_token and DELETE/revoke,
-- which a guest must never read or mutate (least privilege on a control-plane
-- table). The login-free operator claim path goes through a SECURITY DEFINER RPC
-- / the service-role admin client in a later PR, so NO anon/operator policy is
-- invented here.
ALTER TABLE public.panood_camera_operators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS panood_camera_operators_couple_full ON public.panood_camera_operators;
CREATE POLICY panood_camera_operators_couple_full ON public.panood_camera_operators
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = panood_camera_operators.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = panood_camera_operators.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  );

COMMENT ON TABLE public.panood_camera_operators IS
  'Upgraded Panood multicam: per-event camera-operator "seats" (Papic seat-claim clone). Dense camera_index, per-camera claim_qr_token, control-room-scoped RLS (couple + coordinator only, NOT guests); login-free claim runs through a SECURITY DEFINER RPC / admin client. lib/panood-camera-seats.ts.';
