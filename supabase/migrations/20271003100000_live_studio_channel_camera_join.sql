-- live_studio_channel_camera_join — WAVE 4: make a Live Studio CHANNEL joinable
-- by a phone (Live_Studio_Unified_Spec_2026-07-25.md §§ 4b/4c/4d).
--
-- ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────
-- `live_studio_roam_zones.camera_operator_id` shipped with the ROAM foundation
-- (20270918111955 → renamed 20270919193341) and has had ZERO WRITERS ever since,
-- and `live_studio_roam_zones.status` has never left its `'planned'` insert
-- default. So a host could create and name channels but NO PHONE COULD EVER JOIN
-- ONE — a purchased Live Studio was unusable. Wave 3 shipped the honest UI for
-- that state (`channelReadyCaption` → "Waiting for a camera"); this migration is
-- what lets those captions become TRUE.
--
-- ── REUSE, NOT A NEW AUTH MECHANISM ─────────────────────────────────────────
-- A camera joins through the ALREADY-SHIPPED, ALREADY-PROVEN claim path:
--   panood_camera_operators (20270227010000)  — one row per camera "seat", each
--     carrying an unguessable UNIQUE `claim_qr_token`
--   panood_claim_camera()   (20270301500000)  — SECURITY DEFINER claim RPC
--   /panood/cam/[token]                       — login-free, no-install join page
--   panood_rtc_can_access() (20270829134804)  — the private-channel signaling gate
-- Nothing about that is re-invented here. This migration only (a) makes the
-- zone→seat binding SAFE, and (b) adds the heartbeat that turns a claimed seat
-- into a truthful channel status.
--
-- ── (a) THE CROSS-EVENT GUARD — enforced by the DATABASE, not app code ───────
-- `camera_operator_id bigint REFERENCES panood_camera_operators(id)` is a
-- single-column FK, which does NOT constrain the referenced seat to the SAME
-- EVENT as the zone. `live_studio_roam_zones` UPDATE RLS is ROW-level (a host may
-- update any column of their own event's zone) and the Supabase anon key is
-- public by design, so host B could PATCH their own zone's `camera_operator_id`
-- to a bigint belonging to EVENT A and their controller would then render event
-- A's `claim_qr_token` as a QR — a cross-event seat-hijack credential, harvested
-- by enumerating ids.
--
-- The fix is declarative and unbypassable: a COMPOSITE foreign key on
-- (camera_operator_id, event_id). A zone can only ever reference a seat that
-- carries its OWN event_id. MATCH SIMPLE semantics mean a NULL
-- camera_operator_id skips the check entirely (an unbound channel stays legal).
--
-- ON DELETE is left at NO ACTION deliberately. Nothing in the app deletes a
-- `panood_camera_operators` row (verified: zero `.delete()` calls on that table —
-- seats are recycled by reissuing the token, never removed), and an event delete
-- CASCADEs both children inside one statement, so the end-of-statement check has
-- nothing left to fail on. `ON DELETE SET NULL (camera_operator_id)` — the
-- column-list form needed to avoid nulling the NOT NULL event_id — is PG 15+ only
-- and buys nothing here.
--
-- ── (b) THE HEARTBEAT — why `status` can finally be honest ───────────────────
-- `panood_camera_operators.last_seen_at` was documented from day one as "Heartbeat
-- from the live operator feed; drives the 'live'/'offline' status" and has been
-- written exactly once, at claim time. `panood_camera_heartbeat()` is the writer
-- it never had: the joined phone stamps it while its camera is genuinely open, and
-- the stamp cascades to the bound channel.
--
-- It is a SECURITY DEFINER function for the same reason panood_claim_camera is:
-- `panood_camera_operators` RLS is control-room-only (couple + coordinator) and a
-- camera operator is NEITHER, so they cannot write the row that proves their own
-- liveness. The token is the capability; auth.uid() is the identity; the function
-- binds the two under the owner's rights.
--
-- EVENT-SCOPED BY CONSTRUCTION, exactly like the claim RPC: the token is UNIQUE
-- and each seat row carries a single event_id, so a token resolves to one seat on
-- one event and there is no parameter through which another event could be named.
-- It additionally requires `claimer_user_id = auth.uid()` — a token alone cannot
-- heartbeat somebody else's camera, and a REVOKED/reissued token resolves to
-- nothing at all.
--
-- NO CRON. Departure is detected two ways, both without a scheduler:
--   1. This function SWEEPS the event's own stale seats to 'offline' on every
--      beat (a compare-and-swap from live traffic — the repo's cron-free
--      strategy), so one surviving camera reports its dead neighbours.
--   2. The READ path re-applies the staleness window as a pure function
--      (lib/live-studio-channel-cameras.ts → resolveChannelStatus), so a stored
--      'live' whose heartbeat has gone quiet reads as 'offline' even when every
--      phone left at once and no beat remains to run the sweep.
-- The stored column records the last OBSERVED transition; the resolver applies
-- the timeout. Neither ever claims a camera is connected when it isn't.
--
-- Flag-dark: `live_studio_roam_zones` is only read behind
-- NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED. The heartbeat function is additive and
-- unreferenced until that surface ships.
--
-- IDEMPOTENT: DROP CONSTRAINT IF EXISTS → ADD · CREATE INDEX IF NOT EXISTS ·
-- CREATE OR REPLACE FUNCTION. No data change, no backfill, no drops of anything
-- carrying data.

BEGIN;

-- ===========================================================================
-- 1. Composite-FK target. A composite FK needs the referenced (id, event_id)
--    pair to be uniquely addressable. `id` is already the PK, so this UNIQUE is
--    strictly redundant as a uniqueness claim — it exists purely so the FK below
--    has something to point at.
-- ===========================================================================
ALTER TABLE public.panood_camera_operators
  DROP CONSTRAINT IF EXISTS panood_camera_operators_id_event_id_key;
ALTER TABLE public.panood_camera_operators
  ADD CONSTRAINT panood_camera_operators_id_event_id_key UNIQUE (id, event_id);

-- ===========================================================================
-- 2. THE CROSS-EVENT GUARD. Replace the event-blind single-column FK with the
--    composite one. This is the security-critical statement in this migration.
-- ===========================================================================
ALTER TABLE public.live_studio_roam_zones
  DROP CONSTRAINT IF EXISTS live_studio_roam_zones_camera_operator_id_fkey;
ALTER TABLE public.live_studio_roam_zones
  DROP CONSTRAINT IF EXISTS live_studio_roam_zones_camera_same_event_fkey;
ALTER TABLE public.live_studio_roam_zones
  ADD CONSTRAINT live_studio_roam_zones_camera_same_event_fkey
  FOREIGN KEY (camera_operator_id, event_id)
  REFERENCES public.panood_camera_operators (id, event_id);

COMMENT ON COLUMN public.live_studio_roam_zones.camera_operator_id IS
  'The camera "seat" (panood_camera_operators) whose joined phone feeds this channel. Bound by the host from the Live Studio controller; NULL until a join QR is created. Constrained by a COMPOSITE FK on (camera_operator_id, event_id) so a channel can only ever reference a seat on its OWN event — a single-column FK would let a host bind (and therefore display the claim QR of) another event''s seat. lib/live-studio-channel-cameras.ts.';

-- ===========================================================================
-- 3. One seat feeds at most one channel. Two channels sharing a seat would both
--    claim the same phone's picture and both light up on a single join — the
--    controller would be showing the same camera twice under two names.
-- ===========================================================================
CREATE UNIQUE INDEX IF NOT EXISTS live_studio_roam_zones_one_zone_per_camera
  ON public.live_studio_roam_zones (camera_operator_id)
  WHERE camera_operator_id IS NOT NULL;

-- ===========================================================================
-- 4. THE HEARTBEAT. The joined phone's liveness signal, and the ONLY writer of
--    a non-'planned' live_studio_roam_zones.status.
--
--    Verdicts (kept to the same tiny vocabulary as panood_claim_camera):
--      'unauthenticated' — no session at all
--      'invalid'        — no seat for this token, or it is revoked, or it is not
--                         bound to THIS caller (so a stolen token is inert)
--      'beating'        — stamped
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.panood_camera_heartbeat(
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_id    BIGINT;
  v_event UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF p_token IS NULL OR length(btrim(p_token)) = 0 THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  -- Stamp + resolve in ONE statement. The WHERE carries the whole authorization
  -- rule, so there is no window between checking and writing:
  --   • the token must match a seat (UNIQUE → at most one row, on ONE event)
  --   • that seat must be bound to THIS caller — a token on its own is not enough
  --   • it must not be revoked (a reissued QR is dead the instant it is reissued)
  UPDATE public.panood_camera_operators
  SET last_seen_at = NOW(),
      status       = 'live',
      updated_at   = NOW()
  WHERE claim_qr_token  = p_token
    AND claimer_user_id = v_uid
    AND revoked_at IS NULL
  RETURNING id, event_id INTO v_id, v_event;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  -- Cascade to the channel this seat feeds. Scoped by BOTH the seat id and the
  -- seat's own event_id: the composite FK already makes a cross-event binding
  -- impossible, and re-asserting it here means this write could not stray even if
  -- that constraint were ever dropped.
  --
  -- 'disabled' is the HOST'S OWN decision (they turned the channel off) and a
  -- phone must not be able to overrule it — so it is excluded rather than
  -- overwritten.
  UPDATE public.live_studio_roam_zones
  SET status     = 'live',
      updated_at = NOW()
  WHERE camera_operator_id = v_id
    AND event_id           = v_event
    AND status IS DISTINCT FROM 'disabled'
    AND status IS DISTINCT FROM 'live';

  -- ── CRON-FREE SWEEP. One live camera reports its dead neighbours.
  -- Any OTHER claimed seat on this same event whose heartbeat has gone quiet for
  -- more than the staleness window is demoted to 'offline', and its channel with
  -- it. Bounded to this event, driven by real traffic, no scheduler.
  --
  -- 60 seconds is 3× the client's 20s beat — long enough that one dropped beat on
  -- a venue's bad wifi does not blink a working camera to "dropped out", short
  -- enough that a host notices a genuinely dead camera inside a minute.
  UPDATE public.panood_camera_operators
  SET status     = 'offline',
      updated_at = NOW()
  WHERE event_id = v_event
    AND id <> v_id
    AND status = 'live'
    AND claimer_user_id IS NOT NULL
    AND revoked_at IS NULL
    AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '60 seconds');

  UPDATE public.live_studio_roam_zones z
  SET status     = 'offline',
      updated_at = NOW()
  WHERE z.event_id = v_event
    AND z.status = 'live'
    AND EXISTS (
      SELECT 1 FROM public.panood_camera_operators c
      WHERE c.id = z.camera_operator_id
        AND c.event_id = z.event_id
        AND c.status = 'offline'
    );

  RETURN jsonb_build_object('status', 'beating');
END;
$$;

-- SECURITY DEFINER runs the body as the owner; EXECUTE merely lets the caller
-- invoke it. `authenticated` only — a camera operator always has a real
-- auth.uid() by this point (their own account, or the native-anon session minted
-- on the claim POST). Mirrors panood_claim_camera's grant exactly.
REVOKE ALL ON FUNCTION public.panood_camera_heartbeat(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.panood_camera_heartbeat(TEXT) TO authenticated;

COMMENT ON FUNCTION public.panood_camera_heartbeat(TEXT) IS
  'Live Studio camera liveness. The joined phone stamps panood_camera_operators.last_seen_at while its camera is genuinely open, and the stamp cascades to the bound live_studio_roam_zones channel (status → live), plus a cron-free sweep of the same event''s stale seats → offline. Event-scoped by construction (UNIQUE token → one seat → one event) and requires claimer_user_id = auth.uid(), so a stolen or revoked token is inert. Host-set ''disabled'' is never overwritten.';

COMMIT;
