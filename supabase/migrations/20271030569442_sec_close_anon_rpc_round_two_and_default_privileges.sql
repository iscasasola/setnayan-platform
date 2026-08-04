-- SEC · Round two on the anon-callable SECURITY DEFINER surface.
--
-- Pass one (migration 20271028837115) read the 33 functions whose bodies matched
-- a sensitive-table regex and closed 7. This closes what pass two found in the
-- 178 the regex EXCLUDED — where the filter was wrong about roughly a quarter,
-- and 12 findings survived adversarial refutation.
--
-- ── THE ROOT CAUSE, WHICH IS ONE LINE ──────────────────────────────────────
-- `pg_default_acl` grants EXECUTE on new functions in `public` to anon AND
-- authenticated automatically. **203 of 204 SECURITY DEFINER functions carry
-- that grant and no migration ever asked for it.** Every item below is a
-- symptom. §5 stops the bleeding for functions created from here on.
--
-- This is the same default-ACL class already fixed for TABLES (`REVOKE ALL` in
-- every migration) — nobody was doing the equivalent for functions.
--
-- ── WHAT EACH ONE ACTUALLY ALLOWED ─────────────────────────────────────────
-- Verified by reading each body and locating every real `.rpc()` caller.
--
--   save_vendor_service            rewrite ANY vendor's published prices,
--                                  discounts, payment schedules and inclusions.
--                                  The vendor id is a parameter and is trusted.
--   admin_override_publish_review  publish a forged review signed by a fake
--                                  admin — the admin id is a PARAMETER, written
--                                  to override_admin_id, never checked.
--   papic_reserve/release_points   exhaust a live event's Papic pool (every
--                                  guest camera returns 409 mid-reception), or
--                                  refund your own capture cost and shoot
--                                  unlimited. Input is an event id, which sits
--                                  in every guest's URL.
--   vendor_block_booked_date       mark any vendor booked, permanently — the
--                                  vendor's own Remove button filters on a
--                                  different block_source, matches zero rows
--                                  and reports success.
--   ensure_papic_auto_missions     the guard FAILS OPEN for anon (see §3).
--   record_std_view                falsify the Save-the-Date view counter, and
--                                  insert unbounded rows (PK includes p_date).
--   next_screen_name_id            permanently skew the public vendor-name
--                                  sequence for a (city, label) namespace.
--   count_vendor_disputes_30d      a per-vendor dispute leaderboard; the only
--                                  anon path into vendor_disputes.
--
-- ── WHY REVOKING IS SAFE — VERIFIED PER FUNCTION ───────────────────────────
-- Every caller located by its actual `.rpc()` call site, not by a name grep.
--   FOUR have NO caller at all           → closed completely
--   THREE are service-role only          → closed to sessions
--   save_vendor_service was the ONE session caller; its action is switched to
--     the admin client in this same PR (the app already resolves the vendor
--     from the session via ensureProfile, so the ownership answer does not
--     change — it just stops being a parameter the DB trusts)
--   ensure_papic_auto_missions keeps `authenticated` and has its guard fixed
--
-- ⚠ SIGNATURES WERE VERIFIED AGAINST pg_get_function_identity_arguments BEFORE
-- WRITING. The first draft guessed them and got admin_override_publish_review
-- wrong — it takes NINE arguments, not three — which would have failed the
-- whole migration. Guessing an identifier is how the preceding audit run wasted
-- itself on a hand-written list of functions that did not exist.
--
-- IDEMPOTENT.

-- ── 1 · No caller at all — closed completely ───────────────────────────────
-- ⚠ vendor_block_booked_date is granted to PUBLIC as well as anon, so a
-- role-only revoke would not have closed it.
REVOKE ALL ON FUNCTION public.admin_override_publish_review(
  p_appeal_id uuid, p_admin_id uuid, p_reason text,
  p_rating_overall integer, p_rating_communication integer, p_rating_quality integer,
  p_rating_value integer, p_rating_on_time integer, p_body text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vendor_block_booked_date(uuid, date, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_screen_name_id(text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.count_vendor_disputes_30d(uuid)
  FROM PUBLIC, anon, authenticated;

-- ── 2 · Service-role callers only ──────────────────────────────────────────
REVOKE ALL ON FUNCTION public.papic_reserve_event_points(uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.papic_release_event_points(uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_std_view(uuid, date)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_vendor_service(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, boolean)
  FROM PUBLIC, anon, authenticated;

-- ── 3 · The guard that failed OPEN ─────────────────────────────────────────
-- Shipped condition:
--     IF auth.uid() IS NOT NULL AND NOT is_admin() AND NOT EXISTS (member)
--        THEN RAISE
-- With no session `auth.uid()` is NULL, the first conjunct is false, the whole
-- condition is false, and execution falls through to the INSERT. So a LOGGED-IN
-- stranger was refused and an ANONYMOUS one was not — anon was strictly more
-- privileged than an authenticated non-member. An authorization inversion.
--
-- Fixed by requiring a session first. Body otherwise reproduced verbatim, so
-- from here on THIS file is the definition.
CREATE OR REPLACE FUNCTION public.ensure_papic_auto_missions(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted INTEGER;
BEGIN
  -- ⚠ THE FIX (2026-08-01): a missing session is now a REFUSAL, not a bypass.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized to generate missions for event %', p_event_id;
  END IF;

  IF NOT public.is_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.event_members em
       WHERE em.event_id = p_event_id
         AND em.user_id = auth.uid()
         AND em.member_type IN ('couple', 'coordinator')
     ) THEN
    RAISE EXCEPTION 'not authorized to generate missions for event %', p_event_id;
  END IF;

  -- Serialize concurrent generation for this event so the NOT EXISTS check is race-safe.
  PERFORM pg_advisory_xact_lock(hashtext('papic_auto_missions:' || p_event_id::text));

  INSERT INTO public.papic_missions (event_id, mission_type, source, vendor_id, prompt, approved, is_active)
  SELECT ev.event_id,
         'vendor_booth',
         'auto',
         ev.vendor_id,
         -- left(...,256) caps the prompt at 15+256+8 = 279 <= the papic_missions
         -- length(prompt) <= 280 CHECK, so one pathological/uncapped vendor_name
         -- (event_vendors.vendor_name is unbounded TEXT) can't abort the whole batch.
         'Get a photo at ' || left(ev.vendor_name, 256) || '''s booth',
         true,
         true
  FROM public.event_vendors ev
  WHERE ev.event_id = p_event_id
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')  -- "booked" (§3.3)
    AND NOT EXISTS (
      SELECT 1 FROM public.papic_missions m
      WHERE m.vendor_id = ev.vendor_id
        AND m.source = 'auto'
        AND m.mission_type = 'vendor_booth'
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$function$;

-- Session required, but anon has no business here at all.
REVOKE ALL ON FUNCTION public.ensure_papic_auto_missions(uuid) FROM PUBLIC, anon;

-- ── 4 · The root cause: stop NEW functions inheriting the grant ────────────
-- From here on a function is anon-callable only if a migration says so. That is
-- the correct default for a SECURITY DEFINER surface: explicit over implicit,
-- and it fails CLOSED — a forgotten grant shows up immediately in testing,
-- whereas a forgotten revoke has been shipping silently for months.
--
-- Existing functions are unaffected; this governs objects created from now on.
-- The guest surface stays working because those functions already hold their
-- grants (public_seat_lookup, public_venue_scene and friends are untouched).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
