-- live_studio_guest_pick_rtc
--
-- Live Studio Wave 10 · GUEST-PICK AT ₱0 (owner-decided 2026-07-26).
--
-- WHAT THIS ENABLES. A wedding guest on the public event page taps a side camera and
-- opens a plain peer-to-peer WebRTC connection straight to that operator's phone —
-- the same transport as the shipped 1:1 chat call. No YouTube broadcast per camera,
-- no WebRTC→RTMP relay, no stream keys, no OAuth. The director's cut keeps going to
-- YouTube exactly as it does today and is NOT touched by any of this.
--
-- WHY A SECOND SIGNALING TOPIC INSTEAD OF REUSING `panood-rtc:{eventId}`.
-- Because reusing it would break the wedding. That transport is ONE-PUBLISHER →
-- ONE-VIEWER PER SLOT: the phone holds a single peer connection, re-offers by
-- CLOSING it, and accepts any `rtc-answer` matching the slot. A guest answering
-- there would not join the camera, it would TAKE it, and the couple's own controller
-- would go black on that tile mid-ceremony. Migration 20270829134804 was written
-- because that exact hole existed once, and it states the rule: "guests watch the
-- public live page, never the signaling channel." That rule still holds — this adds
-- a SEPARATE topic, `panood-guest:{eventId}`, with its own predicate, so the host
-- path is unreachable from the guest path by construction.
--
-- WHO MAY JOIN `panood-guest:{eventId}`:
--   (a) a control-room member (moderator accepted+not removed, or a legacy
--       `event_members.member_type = 'couple'`) — so the host can watch what guests
--       see while testing;
--   (b) a camera operator who has claimed a live camera on the event — the PUBLISHER
--       side of the fan-out;
--   (c) any signed-in session (including the native-anon session a guest mints on
--       first tap) BUT ONLY when the event has guest-pick switched on and actually
--       has a live camera. The event page is public, so "any visitor" is the correct
--       audience; what (c) bounds is WHICH events have a joinable topic at all, so a
--       stranger cannot open a signaling channel against an arbitrary event id.
--
-- ⚠ THE PAYWALL IS DELIBERATELY NOT IN THIS PREDICATE. Whether an event may show
-- guests any side camera is decided by `canPublishMultiCam` (lib/live-studio-publish.ts)
-- in the public-page loader — the SAME single rule that reduces the YouTube manifest,
-- re-asked on every render against `orders`. Restating that rule in SQL would be a
-- second, forkable copy of a money decision, which Waves 3/5 explicitly avoid.
-- Enforcement is by omission: an un-entitled event's camera roster is empty, so the
-- browser is never told a side camera exists and never opens this channel. An
-- un-entitled host who hand-crafted a client could reach the topic — and would find
-- no guests there, because no guest was ever served the roster. Same honest boundary
-- Wave 5 documents for the program surface.
--
-- ⚠ PRIVACY NOTE (RA 10173), STATED NOT HIDDEN. Peer-to-peer means the two peers
-- learn each other's IP address: a guest watching a side camera exposes their IP to
-- the operator's phone, and vice versa. That is inherent to P2P — a TURN-relayed
-- connection masks it, a direct one does not — and it is NEW behaviour, since guests
-- previously only ever talked to YouTube. SDP/ICE payloads on this topic carry those
-- addresses, which is precisely why the channel is PRIVATE and why (c) requires a
-- session rather than being open.
--
-- Idempotent. No tables, no columns — viewer occupancy is Supabase Realtime presence,
-- which reclaims a slot when the socket closes, so there is no counter to leak.

-- ── The predicate ───────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER for the same reason as panood_rtc_can_access: a camera operator is
-- deliberately not a member of the control-plane tables and cannot read the rows that prove
-- their own membership. Reads only; grants nothing.
CREATE OR REPLACE FUNCTION public.live_studio_guest_rtc_can_access(p_topic TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_event UUID;
BEGIN
  -- Anonymous-but-signed-in is fine (guests mint a native-anon session on first tap,
  -- exactly as camera operators do at claim time); NO session is not.
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_topic IS NULL OR p_topic NOT LIKE 'panood-guest:%' THEN
    RETURN FALSE;
  END IF;

  -- 'panood-guest:' is 13 chars, so the event id starts at 14.
  BEGIN
    v_event := substring(p_topic FROM 14)::uuid;
  EXCEPTION WHEN others THEN
    RETURN FALSE; -- malformed topic — never throw inside an RLS predicate
  END;

  IF v_event IS NULL THEN
    RETURN FALSE;
  END IF;

  -- (a) Control-room member — moderator (accepted, not removed).
  IF EXISTS (
    SELECT 1 FROM public.event_moderators m
    WHERE m.event_id = v_event
      AND m.user_id = v_uid
      AND m.accepted_at IS NOT NULL
      AND m.removed_at IS NULL
  ) THEN
    RETURN TRUE;
  END IF;

  -- (a2) Legacy couple membership.
  IF EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = v_event
      AND em.user_id = v_uid
      AND em.member_type = 'couple'
  ) THEN
    RETURN TRUE;
  END IF;

  -- (b) A camera operator who has claimed a live camera on this event — the publisher.
  IF EXISTS (
    SELECT 1 FROM public.panood_camera_operators c
    WHERE c.event_id = v_event
      AND c.claimer_user_id = v_uid
      AND c.revoked_at IS NULL
  ) THEN
    RETURN TRUE;
  END IF;

  -- (c) A watching guest — only on an event that has guest-pick ON and a camera
  -- actually live. Both halves matter: the switch is the host's explicit consent to
  -- being watchable, and the live-zone test means a dormant or finished event has no
  -- joinable topic at all.
  IF EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.live_studio_roam_zones z ON z.event_id = e.event_id
    WHERE e.event_id = v_event
      AND e.live_studio_guest_pick_enabled IS TRUE
      AND z.status = 'live'
      AND z.camera_operator_id IS NOT NULL
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END $$;

COMMENT ON FUNCTION public.live_studio_guest_rtc_can_access(TEXT) IS
  'Authorization predicate for the Live Studio GUEST-PICK WebRTC signaling channel (panood-guest:{eventId}). Deliberately separate from panood_rtc_can_access: the host channel is one-publisher/one-viewer and a guest answering there would steal the camera from the control room. TRUE for a control-room member, a claimed camera operator, or any signed-in session when the event has guest-pick enabled and a live camera. Entitlement is NOT checked here — canPublishMultiCam decides that once, in the public-page loader.';

REVOKE ALL ON FUNCTION public.live_studio_guest_rtc_can_access(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.live_studio_guest_rtc_can_access(TEXT) TO authenticated;

-- ── The policies ────────────────────────────────────────────────────────────────────────────
-- SELECT = may subscribe/receive (and use presence) on the topic. INSERT = may broadcast onto
-- it. Both are needed: the offer/answer handshake is bidirectional. Scoped to
-- `panood-guest:*` so no other topic — in particular NOT `panood-rtc:*` — is affected.
--
-- Guarded on the `realtime` schema existing: it always does on Supabase, and never does in the
-- PGlite migration-replay harness (tests/db/replay-migrations.ts), which has no Realtime. The
-- security-critical half — the predicate above — is plain `public` SQL and IS replayed.
DO $guard$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE NOTICE 'realtime.messages absent (migration replay / local shell) — skipping panood-guest policies';
    RETURN;
  END IF;

  EXECUTE $ddl$
    DROP POLICY IF EXISTS live_studio_guest_rtc_can_read ON realtime.messages;
    CREATE POLICY live_studio_guest_rtc_can_read
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (
        realtime.topic() LIKE 'panood-guest:%'
        AND public.live_studio_guest_rtc_can_access(realtime.topic())
      );

    DROP POLICY IF EXISTS live_studio_guest_rtc_can_write ON realtime.messages;
    CREATE POLICY live_studio_guest_rtc_can_write
      ON realtime.messages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        realtime.topic() LIKE 'panood-guest:%'
        AND public.live_studio_guest_rtc_can_access(realtime.topic())
      );
  $ddl$;
END $guard$;
