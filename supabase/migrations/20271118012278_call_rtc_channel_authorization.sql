-- 20271118012278_call_rtc_channel_authorization.sql
--
-- 🔴 SECURITY. The couple↔vendor 1:1 call opens its signalling channel as a
-- PUBLIC Supabase Realtime channel (`call:{threadId}`), so anyone who learns a
-- thread id can subscribe to the SDP offer/answer and ICE candidate exchange for
-- that conversation — and can publish into it.
--
-- THIS IS A MISSED BACK-PORT, NOT A DECISION. The identical exposure was found
-- and fixed on the Live Studio transport on 2026-07-21 (`c98636b2a` +
-- 20270829134804), whose own docblock calls `private: true` "a SECURITY
-- REQUIREMENT, not a preference". That fix was correctly carried into the NEWER
-- sibling `lib/panood-guest-webrtc.ts` (created 2026-07-26) and never reached
-- `lib/call-webrtc.ts`, which is OLDER (2026-07-10) and was last touched
-- 2026-07-14 — a week before the fix existed. Five near-identical WebRTC
-- transports; the security edit landed on two of them.
--
-- ⚠ TWO HALVES, AND ONE ALONE IS WORSE THAN NEITHER.
--   1. This migration: policies on `realtime.messages` for `call:%` topics.
--   2. `private: true` on the client channel (same PR).
-- RLS on realtime.messages is evaluated for PRIVATE channels ONLY — a public
-- channel bypasses it entirely. So the flag without the policy authorises NOBODY
-- and takes calls down; the policy without the flag is inert. They ship together.
--
-- ── WHY THE PREDICATE DELEGATES INSTEAD OF RESTATING ────────────────────────
-- `call_rtc_can_access()` is SECURITY INVOKER and simply asks whether the caller
-- can SELECT the thread row. That means the answer is decided by
-- `chat_threads_member_read`, the policy that ALREADY defines who may read this
-- conversation:
--
--   event_id IN current_couple_event_ids()
--   OR vendor_profile_id IN current_vendor_profile_ids()
--   OR (vendor_profile_id IN current_vendor_ids('viewer')
--       AND event_id IN agent_customer_event_ids())
--
-- Restating that here would create a second copy that drifts the first time
-- thread access changes — this repo has a documented history of exactly that
-- (two files ranking the same values in opposite orders; one status vocabulary
-- spelled 15 times under 6 names, one copy naming values that do not exist).
-- Delegating makes "can join the call" definitionally equal to "can read the
-- conversation", forever, with no second thing to maintain.
--
-- ⚠ DELIBERATELY **NOT** SECURITY DEFINER. The panood equivalent had to be
-- definer because a camera operator is not a member of the control-plane tables
-- and cannot read the rows proving their own membership. No such asymmetry
-- exists here: both parties to a call are already readers of the thread.
-- Definer would silently widen this to anyone who can name a thread id.
--
-- ── NOT COVERED, ON PURPOSE ────────────────────────────────────────────────
-- `lib/mesh-call-webrtc.ts` (`mesh:{room}`) is also public, but its only
-- consumers are `/prototype/mesh-call` — a prototype route, not a shipped
-- surface. Left alone rather than bundled: a security migration should change
-- exactly what it claims to change. Worth closing when that prototype ships.
--
-- BLAST RADIUS: additive. Adding policies for a NEW topic prefix cannot affect
-- the existing `panood-rtc:%` policies, and cannot affect any public channel.
--
-- Idempotent.

-- ── The predicate ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.call_rtc_can_access(p_topic TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER          -- see above: invoker is the point, not an oversight
SET search_path = public, pg_temp
AS $$
DECLARE
  v_thread UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_topic IS NULL OR p_topic NOT LIKE 'call:%' THEN
    RETURN FALSE;
  END IF;

  -- 'call:' is 5 chars, so the thread id starts at 6.
  BEGIN
    v_thread := substring(p_topic FROM 6)::uuid;
  EXCEPTION WHEN others THEN
    RETURN FALSE; -- malformed topic — never throw inside an RLS predicate
  END;

  IF v_thread IS NULL THEN
    RETURN FALSE;
  END IF;

  -- The whole rule. RLS on chat_threads answers it; this function only asks.
  RETURN EXISTS (
    SELECT 1 FROM public.chat_threads t WHERE t.thread_id = v_thread
  );
END $$;

COMMENT ON FUNCTION public.call_rtc_can_access(TEXT) IS
  'Authorises a private Realtime channel for the couple<->vendor 1:1 call (topic call:{thread_id}). SECURITY INVOKER on purpose: it asks whether the caller can SELECT the thread, so chat_threads_member_read is the single definition of who may join a call — no second copy to drift. Returns FALSE for anon, a non-call topic, or a malformed id; never throws.';

GRANT EXECUTE ON FUNCTION public.call_rtc_can_access(TEXT) TO authenticated;

-- ── The policies ───────────────────────────────────────────────────────────
DO $guard$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE NOTICE 'realtime.messages absent (migration replay / local shell) — skipping call-rtc policies';
    RETURN;
  END IF;

  EXECUTE $ddl$
    DROP POLICY IF EXISTS call_rtc_participants_can_read ON realtime.messages;
    CREATE POLICY call_rtc_participants_can_read
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (
        realtime.topic() LIKE 'call:%'
        AND public.call_rtc_can_access(realtime.topic())
      );

    DROP POLICY IF EXISTS call_rtc_participants_can_write ON realtime.messages;
    CREATE POLICY call_rtc_participants_can_write
      ON realtime.messages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        realtime.topic() LIKE 'call:%'
        AND public.call_rtc_can_access(realtime.topic())
      );
  $ddl$;
END $guard$;
