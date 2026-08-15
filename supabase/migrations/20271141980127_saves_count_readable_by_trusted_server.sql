-- saves_count_readable_by_trusted_server
--
-- ─── THE PUBLIC "SAVED BY N COUPLES" BADGE HAS NEVER RENDERED ────────────
-- `count_saves_for_vendor` gates on "you own this profile OR you are an admin"
-- and RAISEs otherwise. The public shop page (`app/v/[slug]/page.tsx`, which
-- also serves the bare-root `/{shop}` address) calls it through the
-- SERVICE-ROLE client, because a stranger reading a shop page has no session at
-- all. Service role is neither the owner nor an admin, so the gate fired on
-- every public render and the page's `fail-soft → 0` turned the refusal into
-- the number zero. `FAVORITES_MIN_DISPLAY` is 3, so the badge never drew.
--
-- 🔑 SERVICE ROLE BYPASSES **RLS**, NOT A HAND-WRITTEN `RAISE EXCEPTION` INSIDE
-- A SECURITY DEFINER FUNCTION. The call site's own comment asserted the
-- opposite — *"the RPC's EXECUTE grant is authenticated-only, but a public
-- render needs it"* — which is true about the GRANT and silent about the gate
-- in the body. Getting past the door is not getting past the bouncer.
--
-- Proved against PRODUCTION before this was written, by running the real
-- function as the real role:
--     SET LOCAL ROLE service_role;
--     SELECT public.count_saves_for_vendor(<a real vendor id>);
--     → REFUSED  SQLSTATE=P0001  MESSAGE=forbidden
-- which is the same P0001 the runtime log has carried since 2026-08-08.
--
-- ─── WHAT THIS CHANGES, AND WHAT IT DELIBERATELY DOES NOT ────────────────
-- The gate gains ONE disjunct: the trusted server. It does NOT open to `anon`
-- and does NOT open to an arbitrary logged-in user — a browser session still
-- has to own the profile or be an admin, exactly as before.
--
-- ⚖ THIS GRANTS THE SERVER NO CAPABILITY IT LACKED. Service role already
-- bypasses RLS on `vendor_follows` and `guest_saved_vendors` and could count
-- both tables directly. The only thing the refusal achieved was forcing our own
-- server to either go around the function — duplicating the definition of what
-- the number MEANS, in a second place, which is how the two surfaces drift —
-- or to show nothing. The function still returns ONLY an integer; no
-- `user_id` has ever left it and none does now, so `guest_saved_vendors` stays
-- owner-only at the RLS layer exactly as its original comment promises.
--
-- Owner context: favourites were ruled PUBLIC on 2026-07-02 ("favorites PUBLIC
-- / viewers vendor-only"), and the app floors the published figure at 3 so a
-- tiny count can never de-anonymise anyone. This migration makes the shipped
-- product behave the way that ruling already said it should.
--
-- ─── 🚨 WHY `current_setting('role')` AND *NOT* `current_user` ───────────
-- THE FIRST CUT OF THIS MIGRATION USED THE REPO'S USUAL IDIOM,
-- `current_user NOT IN ('authenticated','anon')`, AND IT OPENED THE GATE TO
-- EVERYONE — `anon` included. It was caught by dry-running this exact function
-- against production inside a rolled-back transaction before it was committed;
-- reading it did not catch it, and the unit tests could not have.
--
-- 🔑 **INSIDE A `SECURITY DEFINER` BODY, `current_user` IS THE FUNCTION'S
-- OWNER, NOT THE CALLER.** Measured in prod, in a SECURITY DEFINER function,
-- under each role in turn:
--
--     SET LOCAL ROLE …    current_user   session_user   current_setting('role')
--     service_role        postgres       postgres       service_role
--     authenticated       postgres       postgres       authenticated
--     anon                postgres       postgres       anon
--
-- So `current_user NOT IN ('authenticated','anon')` is ALWAYS TRUE here, and
-- the gate would have admitted a signed-out browser to every vendor's tally.
-- That is worse than the bug it was fixing — the same shape as the 2026-08-12
-- moderation revoke that would have shipped silent universal auto-approval.
--
-- ✅ THE EXISTING USES OF THAT IDIOM ARE FINE, VERIFIED AGAINST PROD BY
-- `prosecdef` RATHER THAN BY READING: all six live functions that carry
-- `current_user NOT IN` — `guard_events_ai_price_tier` ·
-- `guard_users_privilege_columns` · `tg_chat_messages_derive_sender` ·
-- `tg_coordinator_broadcasts_derive_sender` · `tg_pin_moderation_state` ·
-- `tg_vendor_payment_methods_pin_moderation` — are SECURITY **INVOKER**, where
-- `current_user` really is the caller. The idiom is right for them and wrong
-- here. **Copy an idiom with its precondition, or don't copy it.**
--
-- `auth.role()` is not used because it reads a JWT claim that is absent under a
-- plain role switch (measured NULL in all three rows above), and because the
-- PGlite replay shim answers `'anon'` for it unconditionally — a branch keyed
-- on it is dead code in every db test in this repo.
--
-- The test is written as an EQUALITY on the one role being admitted, not as a
-- NOT-IN list of the ones excluded: a deny-list is a bill you have to keep
-- paying, and a new Postgres role would silently join the allowed side.

CREATE OR REPLACE FUNCTION public.count_saves_for_vendor(p_vendor_profile_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  -- Ownership gate: the vendor who owns this profile, an admin, or the trusted
  -- server rendering the public shop page. A browser session that is neither
  -- the owner nor an admin is refused exactly as before.
  --
  -- ⚠ `current_setting('role')`, NOT `current_user` — see the header. In a
  -- SECURITY DEFINER body `current_user` is this function's OWNER, so a
  -- `current_user`-based test here admits everyone, `anon` included.
  IF NOT (
    current_setting('role', true) = 'service_role'
    OR p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Distinct savers across both surfaces. A user who BOTH follows and bookmarks
  -- the vendor counts once (UNION dedupes on the saver id). Only the count
  -- escapes the function.
  SELECT COUNT(*)::INTEGER
    INTO v_total
  FROM (
    SELECT follower_user_id AS saver
    FROM public.vendor_follows
    WHERE vendor_profile_id = p_vendor_profile_id
    UNION
    SELECT user_id AS saver
    FROM public.guest_saved_vendors
    WHERE vendor_profile_id = p_vendor_profile_id
  ) AS savers;

  RETURN COALESCE(v_total, 0);
END;
$$;

-- Unchanged from the original migration, restated because CREATE OR REPLACE
-- does not touch privileges and a reader should not have to go find them.
-- `anon` is NOT granted: a signed-out browser never calls this. The public
-- shop page reaches it through the SERVER, which is what the new disjunct
-- above admits.
REVOKE ALL ON FUNCTION public.count_saves_for_vendor(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_saves_for_vendor(UUID) TO authenticated;

COMMENT ON FUNCTION public.count_saves_for_vendor(UUID) IS
  'Shortlist Radar (Wave 2): distinct-saver COUNT for a vendor profile, across vendor_follows + guest_saved_vendors. SECURITY DEFINER; returns only the integer, never user_ids — so guest_saved_vendors stays owner-only at the RLS layer. Readable by the profile owner, an admin, or the trusted server (service_role) that renders the public shop page — the last of these added 2026-08-15, because the public badge had raised P0001 forbidden on every render since it shipped. A browser session that is neither owner nor admin is still refused.';
