-- ⭐ A CAMERA'S PICTURE REACHES THE CONTROLLER — one missing GRANT was the whole defect.
--
-- ── WHAT WAS BROKEN ────────────────────────────────────────────────────────────
-- No camera had EVER put a picture on the Live Studio controller. `panood_broadcasts`
-- and `live_studio_roam_streams` are both 0 and always have been. Claim, binding and
-- heartbeat all worked; media never arrived.
--
-- The signalling channel `panood-rtc:{eventId}` is a PRIVATE Supabase Realtime channel,
-- so every subscribe is judged by RLS on `realtime.messages`. Measured against prod on
-- 2026-09-01, both ends were refused with:
--
--     CHANNEL_ERROR — Unauthorized: You do not have permissions to read from
--                     this Channel topic: panood-rtc:044f7e64-…
--
-- …while `public.panood_rtc_can_access('panood-rtc:044f7e64-…')` returned TRUE for the
-- very same uid. The predicate was never the problem.
--
-- ── WHAT ACTUALLY REFUSED ──────────────────────────────────────────────────────
-- Every private topic on this project shares ONE table — `realtime.messages` — and
-- therefore ONE set of policies. Postgres OR-evaluates the permissive policies on a
-- table, so a policy belonging to a COMPLETELY DIFFERENT topic family is still executed
-- when Live Studio subscribes. Reproduced exactly, as role `authenticated`, with
-- `realtime.topic` set to a `panood-rtc:` topic:
--
--     ERROR: 42501: permission denied for function live_studio_guest_rtc_can_access
--
-- `live_studio_guest_rtc_can_access` is the predicate behind the GUEST-PICK policies
-- (`panood-guest:%`). `authenticated` had lost EXECUTE on it, so evaluating the guest
-- policy raised — and a raise inside RLS is not "this policy said no", it is "the whole
-- check failed". Live Studio's own policy never got the chance to say yes.
--
-- ── WHERE THE GRANT WENT ───────────────────────────────────────────────────────
-- Migration 20271006520000 created the function AND granted it:
--     GRANT EXECUTE ON FUNCTION public.live_studio_guest_rtc_can_access(TEXT) TO authenticated;
-- Migration 20271031571953 (`sec_close_final_anon_rpc_survivors`) then revoked it, with
-- this reason recorded in its own header:
--     "live_studio_guest_rtc_can_access NO caller → closed completely"
--
-- 🔑 IT HAS NO CALLER IN TYPESCRIPT. ITS CALLER IS AN RLS POLICY, WRITTEN IN SQL, ON A
-- TABLE IN ANOTHER SCHEMA. A grep of `apps/` finds nothing and reads as proof of
-- absence. The sweep that revoked it was, by its own header, a sweep about fixing
-- classes rather than instances — and this is that lesson turned on the sweep itself.
--
-- ── AND WHY IT COST THREE TRANSPORTS, NOT ONE ──────────────────────────────────
-- Because the failure is table-wide, not topic-wide, it took down every private channel
-- the product has: Live Studio cameras (`panood-rtc:`), guest-pick (`panood-guest:`) and
-- 1:1 calls (`call:`). The homepage two-phone demo kept working throughout for one
-- reason only — `lib/demo-webrtc.ts` uses a PUBLIC channel, which consults no policy at
-- all. That is why the network, the STUN/TURN config and the camera hardware all
-- exonerated themselves in testing: none of them was ever involved.
--
-- ── THE MEASUREMENT ────────────────────────────────────────────────────────────
-- Two native-anonymous sessions, both authorized by `panood_rtc_can_access`, subscribing
-- to the real prod topic and exchanging the real `cam-hello` / `viewer-hello` handshake.
-- Same script, same users, eleven seconds apart, one GRANT between them:
--
--   before  private: CHANNEL_ERROR / CHANNEL_ERROR — 0 messages delivered
--   after   private: SUBSCRIBED    / SUBSCRIBED    — 2 messages delivered
--   control public demo-rtc topic: SUBSCRIBED / SUBSCRIBED — 2 messages, both runs
--
-- ── SECURITY POSTURE ───────────────────────────────────────────────────────────
-- This restores exactly the grant migration 20271006520000 shipped, and nothing wider:
-- `authenticated` only — NOT `anon`, whose revocation stands. It matches both sibling
-- predicates, which are and have always been `authenticated`-EXECUTE in prod
-- (`panood_rtc_can_access`, `call_rtc_can_access`).
--
-- ⚠ The 20271031571953 header's OTHER concern is real and is NOT resolved here: the
-- predicate returns TRUE for any signed-in session (native-anonymous included) while a
-- roam zone is live and guest-pick is on, so an event id — which travels in guest-facing
-- URLs — is enough to watch. That is a question about what guest-pick is FOR, it applies
-- equally to the two siblings, and it cannot be answered by a grant. Revoking EXECUTE
-- did not answer it either: it silently broke all three transports instead. Flagged for
-- the owner rather than decided here.
--
-- Guarded by `apps/web/tests/db/realtime-policy-predicates-are-callable.db.test.ts`,
-- which asserts the property for EVERY predicate any `realtime.messages` policy names —
-- the class, not this instance.
--
-- IDEMPOTENT.

DO $$
BEGIN
  IF to_regprocedure('public.live_studio_guest_rtc_can_access(text)') IS NULL THEN
    RAISE NOTICE 'live_studio_guest_rtc_can_access absent — nothing to grant';
    RETURN;
  END IF;

  -- `anon` stays revoked: 20271031571953 was right that an anonymous REST caller has no
  -- business asking this question. Realtime evaluates policies as `authenticated`.
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.live_studio_guest_rtc_can_access(TEXT) TO authenticated';
END $$;
