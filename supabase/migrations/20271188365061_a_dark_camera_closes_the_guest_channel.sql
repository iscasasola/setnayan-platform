-- a_dark_camera_closes_the_guest_channel
--
-- Live Studio · the GUEST-PICK signaling channel stops admitting strangers to an
-- event whose cameras went dark hours ago.
--
-- ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
-- `live_studio_guest_rtc_can_access` clause (c) — the one that decides whether a
-- plain signed-in visitor may open `panood-guest:{eventId}` — asked only:
--
--     z.status = 'live' AND z.camera_operator_id IS NOT NULL
--
-- Both halves are STORED state, written by a phone that was live at the time and
-- never unwritten by anything. Its own migration promised the opposite:
-- "the live-zone test means a dormant or finished event has no joinable topic at
-- all". That promise did not hold, for a reason that is structural rather than
-- accidental — `panood_camera_heartbeat`'s demotion sweep is deliberately
-- CRON-FREE: one live camera reports its dead neighbours. When the LAST camera on
-- an event leaves, there is no next heartbeat, so nothing ever demotes the final
-- seat or its zone. A finished wedding keeps a row saying 'live' forever.
--
-- MEASURED IN PRODUCTION, 2026-09-01, not argued from the source:
--
--     select set_config('request.jwt.claims',
--              '{"sub":"<a uid that is not a member, moderator or operator>",
--                "role":"authenticated"}', true),
--            public.live_studio_guest_rtc_can_access('panood-guest:<event>');
--     → TRUE
--
-- on an event whose only 'live' zone was bound to a seat last seen 13,843 seconds
-- earlier (230× the 60s staleness window), whose `live_studio_roam_manifest` was
-- empty, and which has never had a `panood_broadcasts` row at all. A second event
-- with no live zone returned FALSE in the same statement, so the predicate was
-- being exercised — this was not "true for everything".
--
-- ── WHAT THE CONTROLLER ALREADY KNEW ────────────────────────────────────────
-- Nothing here is a new rule. `resolveChannelStatus`
-- (apps/web/lib/live-studio-channel-cameras.ts) has resolved the honest status at
-- READ time since Wave 4, applying exactly these two tests to exactly this stored
-- state, and its own docblock names this hole in the seat table:
--
--     "That leaves a zone row saying 'live' with a recent last_seen_at and nobody
--      holding the camera. Without this input the controller would read 'Camera
--      connected' over an empty seat — the exact class of lie this module exists
--      to prevent."
--
-- So the controller has been honest and the RLS predicate has not. This migration
-- adds ONE condition to clause (c) — the seat bound to the live zone must have
-- beaten inside the staleness window:
--
--     AND c.last_seen_at IS NOT NULL
--     AND c.last_seen_at > NOW() - INTERVAL '60 seconds'
--
-- 60 seconds is the SAME window as `CHANNEL_STALE_MS` and as the
-- `INTERVAL '60 seconds'` in `panood_camera_heartbeat`'s own sweep — three beats of
-- the phone's 20s heartbeat. One dropped beat on a venue's bad wifi does not close
-- the channel; a phone that is gone stops admitting strangers inside a minute
-- WITHOUT depending on another camera to come along and notice.
--
-- ⚠ ONE CONDITION, AND DELIBERATELY NOT FOUR. The first cut of this migration also
-- required the seat to be claimed and un-revoked. That was wrong twice over, and
-- `tests/db/live-studio-guest-pick-authz.db.test.ts` says so in its own words:
--
--     "THE PREDICATE ALONE DOES NOT LOCK A REVOKED OPERATOR OUT, and that is
--      correct: … a person whose camera was revoked is still a person who may watch
--      the wedding. Revocation takes away their ability to PUBLISH, not their
--      standing as a spectator."
--
-- The claimed/un-revoked filter already lives in ONE place — `fetchGuestPickCameras`
-- (lib/live-studio-guest-pick.ts), the roster, which is the enforced-by-omission
-- containment this whole feature is built on. Copying it here would have made a
-- second, forkable author of the same rule and overturned a recorded decision.
--
-- Freshness reaches the same place without either cost: `panood_camera_heartbeat`
-- REFUSES a token whose seat has been reissued or revoked (its WHERE requires
-- `claimer_user_id = auth.uid() AND revoked_at IS NULL`), so a pulled seat's stamp
-- FREEZES and crosses the window on its own within a minute. One condition; no
-- duplicated rule.
--
-- ⚠ WHAT THIS DELIBERATELY DOES NOT DO.
--   · It does not consult `panood_broadcasts` or `live_studio_roam_streams`.
--     Guest-pick is peer-to-peer at ₱0 and carries no YouTube broadcast per
--     camera — tying it to a broadcast row would close the channel on a host who
--     is rehearsing, which the ₱0 decision (2026-07-26) exists to allow.
--   · It does not restate the ₱3,000 entitlement. That stays exactly where the
--     original migration put it: `canPublishMultiCam`, asked once in the
--     public-page loader. A second copy of a money rule in SQL is the thing Waves
--     3/5 refuse, and this migration refuses it too.
--   · It does not WRITE. No trigger demotes the stale zone row, because the
--     controller already resolves the honest status at read time and a writer here
--     would be a second author of a column the heartbeat RPC owns. The stale row
--     stays; it simply stops being an admission ticket.
--   · It does not add freshness to the ROSTER. `fetchGuestPickCameras` still offers
--     a guest a camera whose phone left hours ago — the same defect on the read
--     side, and a change to what guests are SHOWN rather than what they may open.
--     Flagged, not smuggled in here.
--
-- Clauses (a), (a2) and (b) are UNCHANGED and copied through verbatim: a
-- control-room member and the operator publishing the fan-out must still reach the
-- channel while testing, precisely so a host can watch what guests see BEFORE any
-- camera is beating.
--
-- Idempotent: CREATE OR REPLACE plus the same REVOKE/GRANT pair the predicate has
-- carried since 20271187719883 (which exists because 20271031571953 revoked it on
-- a "no caller in the codebase" reading — the caller was a policy, in SQL).

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
  -- that is ACTUALLY BEATING RIGHT NOW.
  --
  -- The switch is the host's explicit consent to being watchable. The camera test is
  -- no longer "a row once said live": the zone must be live AND its bound seat must
  -- have stamped a heartbeat inside the window. A dormant, finished or reissued
  -- event fails that and has no joinable topic — which is what this predicate
  -- claimed to do before, and now does.
  --
  -- WHO may publish there is still the roster's question, not this one:
  -- `fetchGuestPickCameras` drops an unclaimed or revoked seat, and a guest is never
  -- told a camera exists that it dropped. See the migration header.
  IF EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.live_studio_roam_zones z
      ON z.event_id = e.event_id
    JOIN public.panood_camera_operators c
      ON c.id = z.camera_operator_id
     AND c.event_id = z.event_id
    WHERE e.event_id = v_event
      AND e.live_studio_guest_pick_enabled IS TRUE
      AND z.status = 'live'
      AND c.last_seen_at IS NOT NULL
      AND c.last_seen_at > NOW() - INTERVAL '60 seconds'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END $$;

COMMENT ON FUNCTION public.live_studio_guest_rtc_can_access(TEXT) IS
  'Authorization predicate for the Live Studio GUEST-PICK WebRTC signaling channel (panood-guest:{eventId}). Deliberately separate from panood_rtc_can_access: the host channel is one-publisher/one-viewer and a guest answering there would steal the camera from the control room. TRUE for a control-room member, a claimed camera operator, or any signed-in session when the event has guest-pick enabled AND the seat bound to a live zone has beaten inside the 60s staleness window (same window as CHANNEL_STALE_MS and panood_camera_heartbeat''s sweep) — a stored ''live'' zone alone is NOT enough, because that cron-free sweep never demotes the last camera to leave. WHO may publish stays the roster''s question (fetchGuestPickCameras drops unclaimed/revoked seats); this predicate deliberately does not restate it. Entitlement is NOT checked here — canPublishMultiCam decides that once, in the public-page loader.';

-- Unchanged from 20271006520000 / 20271187719883 — restated so a fresh replay ends
-- in the same ACL as production. CREATE OR REPLACE preserves grants, so on prod
-- both lines are no-ops.
REVOKE ALL ON FUNCTION public.live_studio_guest_rtc_can_access(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.live_studio_guest_rtc_can_access(TEXT) TO authenticated;
