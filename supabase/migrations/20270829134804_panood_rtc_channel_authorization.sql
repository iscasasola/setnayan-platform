-- panood_rtc_channel_authorization
--
-- 🔴 SECURITY FIX. The Live Studio WebRTC signaling channel `panood-rtc:{eventId}` had NO
-- authorization of any kind.
--
-- THE HOLE: `lib/panood-webrtc.ts` opened a PUBLIC Supabase Realtime broadcast channel keyed
-- only on the event id. Public channels bypass RLS entirely, and `realtime.messages` carried
-- ZERO policies (verified against prod 2026-07-21: relrowsecurity = true, policy_count = 0).
-- Event ids travel in dashboard URLs and QR links, so they are not secret.
--
-- THE IMPACT — worse than eavesdropping. The transport is ONE PUBLISHER → ONE VIEWER per camera
-- slot: an operator phone offers, and whoever answers first owns that stream. A stranger holding
-- an event id could send `viewer-hello`, answer a camera's offer, and the couple's own control
-- room would LOSE that camera — a black tile mid-ceremony, on a day that cannot be re-run. They
-- could also inject fake `cam-hello`/`rtc-offer` traffic to churn the console, and read every
-- SDP/ICE payload (which carries participants' IP addresses — an RA 10173 exposure).
--
-- THE FIX, two halves that ONLY work together:
--   1. This migration: policies on `realtime.messages` for `panood-rtc:*` topics.
--   2. `lib/panood-webrtc.ts`: the channel is opened with `private: true`.
-- RLS on realtime.messages is evaluated for PRIVATE channels only — a public channel is
-- unauthenticated by definition. Shipping either half alone changes nothing, so they land in
-- the same PR.
--
-- WHO MAY JOIN: exactly the two roles that need to. (a) A control-room member — a moderator who
-- accepted and was not removed, or a legacy `event_members.member_type = 'couple'`; mirrors
-- lib/panood-control-room-access.ts so the signaling gate and the page gate cannot drift.
-- (b) A camera operator who has actually CLAIMED a camera on this event. Camera operators sign
-- in through a native-anon session at claim time (panood_claim_camera, 20270301500000) and the
-- claim binds claimer_user_id = auth.uid(), so every legitimate participant has a real uid to
-- match on. Nobody else — guests watch the public live page, never the signaling channel.
--
-- BLAST RADIUS: none. `realtime.messages` has no existing policies, so private channels are
-- deny-all today and nothing in the app uses them (grep: zero `private: true` Realtime channels).
-- These policies are permissive and topic-scoped, so they grant access to `panood-rtc:*` and
-- change nothing else.
--
-- Idempotent.

-- ── The predicate ───────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER because a camera operator is deliberately NOT a member of the control-plane
-- tables (panood_camera_operators RLS is control-room-only), so they cannot read the rows that
-- prove their own membership. Same posture as panood_claim_camera. Reads only; grants nothing.
CREATE OR REPLACE FUNCTION public.panood_rtc_can_access(p_topic TEXT)
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
  -- Anonymous-but-signed-in is fine (camera operators are native-anon); NO session is not.
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_topic IS NULL OR p_topic NOT LIKE 'panood-rtc:%' THEN
    RETURN FALSE;
  END IF;

  -- 'panood-rtc:' is 11 chars, so the event id starts at 12.
  BEGIN
    v_event := substring(p_topic FROM 12)::uuid;
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

  -- (b) A camera operator who has claimed a LIVE camera on this event. A revoked/reissued
  -- token drops the operator immediately — same rule the claim RPC enforces.
  IF EXISTS (
    SELECT 1 FROM public.panood_camera_operators c
    WHERE c.event_id = v_event
      AND c.claimer_user_id = v_uid
      AND c.revoked_at IS NULL
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END $$;

COMMENT ON FUNCTION public.panood_rtc_can_access(TEXT) IS
  'Authorization predicate for the Live Studio WebRTC signaling channel. TRUE only for a control-room member or a claimed camera operator on the event encoded in the panood-rtc:{eventId} topic.';

REVOKE ALL ON FUNCTION public.panood_rtc_can_access(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.panood_rtc_can_access(TEXT) TO authenticated;

-- ── The policies ────────────────────────────────────────────────────────────────────────────
-- SELECT = may subscribe/receive on the topic. INSERT = may broadcast onto it. Both are needed:
-- the offer/answer handshake is bidirectional, so a read-only participant could not complete a
-- connection. Both are scoped to `panood-rtc:*` so no other topic is affected.
-- Guarded on the `realtime` schema existing. It always does on Supabase; it does NOT in the
-- PGlite migration-replay harness (tests/db/replay-migrations.ts), which has no Realtime. Without
-- this guard the whole db-test suite fails to boot. The predicate above — the security-critical
-- half — is plain `public` SQL and IS replayed and tested (tests/db/panood-rtc-authz.db.test.ts).
DO $guard$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE NOTICE 'realtime.messages absent (migration replay / local shell) — skipping panood-rtc policies';
    RETURN;
  END IF;

  EXECUTE $ddl$
    DROP POLICY IF EXISTS panood_rtc_participants_can_read ON realtime.messages;
    CREATE POLICY panood_rtc_participants_can_read
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (
        realtime.topic() LIKE 'panood-rtc:%'
        AND public.panood_rtc_can_access(realtime.topic())
      );

    DROP POLICY IF EXISTS panood_rtc_participants_can_write ON realtime.messages;
    CREATE POLICY panood_rtc_participants_can_write
      ON realtime.messages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        realtime.topic() LIKE 'panood-rtc:%'
        AND public.panood_rtc_can_access(realtime.topic())
      );
  $ddl$;
END $guard$;
