-- a_shop_can_be_paused_or_closed
-- Created via `pnpm migration:new`. Idempotent. Writes NO data.
-- ============================================================================
-- ⏸ A SHOP CAN BE PAUSED OR CLOSED — BY ITS OWN TEAM, AND BY SETNAYAN.
--
-- Rulings (specs DECISION_LOG):
--   · 2026-10-31 "SHOP STATUS RULED": *"They can pause and close. Admin can also do that"* — a supplier can pause
--     (hidden from search, booked events kept) and close their own shop; Admin can do both. "NOT BUILT: needs a
--     shop-wide pause column and a close flow". Its place is Shop ⚙ › Shop status.
--   · 2026-11-16 "AN ADMIN-HIDDEN SHOP IS PAUSED FOR EVERYTHING NEW": no new asks or bookings, no new client
--     imports, its website and QR read "This shop is paused"; existing bookings continue and their chats stay open;
--     unhiding restores everything; archiving remains the stronger, permanent step.
--
-- ── WHY A NEW COLUMN (RULE 0, measured) ─────────────────────────────────────
-- `public_visibility = 'hidden'` cannot carry a pause: it is the column DEFAULT and the resting state of every
-- shop Setnayan has not decided yet, and since 15 Nov such a shop is booked through its own page while `hidden`
-- (20271348170528). So an admin's hide of an UNVERIFIED shop changed nothing — the gap PR #7828 flagged. Nothing
-- else on vendor_profiles records a pause (fraud_suspended_at is the fraud desk's, papers_lapsed_at the renewal
-- pass's, Clients › Dates' "Open for bookings" is one day, `bookings_open` is platform-wide).
--
-- CLOSE needs NO new column: `public_visibility = 'archived'` already IS a closed shop to every gate — its page
-- opens for nobody (shopPageGate), it is never findable, never bookable (both halves). A close writes that value,
-- through the one door below, so a supplier can reach it without a grant on the column.
--
-- ── WHAT LANDS ──────────────────────────────────────────────────────────────
--   1. vendor_profiles.paused_at + paused_by ('supplier' | 'admin') — set together, cleared together.
--      Column grants: SELECT to authenticated only (the shop's own dashboard and the booking doors read it);
--      anon gets nothing — a new column on this table would otherwise ride the table-level grant.
--   2. guard_vendor_shop_pause — a session (not an admin) cannot write either column directly; only the door does.
--   3. is_findable redefined IN PLACE (SET EXPRESSION) with `AND paused_at IS NULL` — so every list drops a paused
--      shop through the gate it already applies; vendor_market_stats and the partial index are untouched.
--   4. enforce_booking_requires_verified_vendor — the latest body (20271348170528) with ONE new CASE arm,
--      `paused`, after the fraud arms: a paused shop takes no NEW ask and no NEW booking. Existing bookings and
--      existing asks are never re-checked (unchanged).
--   5. set_shop_status(shop, status) — the ONE door (SECURITY DEFINER). Rules:
--        · 'paused'  — Setnayan (is_admin) → paused_by 'admin'; the shop's owner or an admin of its team →
--                      paused_by 'supplier'. A pause by Setnayan is never overwritten by the shop's own.
--        · 'open'    — clears a pause. Only Setnayan lifts a pause Setnayan set.
--        · 'closed'  — public_visibility → 'archived', pause cleared. The shop's OWNER only (not a team admin),
--                      and only with no open booking (contracted · deposit_paid · delivered) — the approved
--                      drawing's "Finish or cancel your bookings first". Setnayan may close regardless.
--        · A closed shop is not reopened through this door — the admin's existing visibility controls do that.
--   6. vendor_profiles_self re-projected (its projection is frozen at CREATE) so the shop's own dashboard reads
--      the pause.
-- Held by apps/web/tests/db/a-shop-can-be-paused-or-closed.db.test.ts.
-- ============================================================================

-- ── 1 · the pause ──────────────────────────────────────────────────────────
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS paused_by TEXT;

ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_paused_by_check;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_paused_by_check
  CHECK (paused_by IS NULL OR paused_by IN ('supplier', 'admin'));

ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_pause_pair_check;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_pause_pair_check
  CHECK ((paused_at IS NULL) = (paused_by IS NULL));

COMMENT ON COLUMN public.vendor_profiles.paused_at IS
  'When this shop was PAUSED (owner 2026-10-31 "They can pause and close. Admin can also do that"; 2026-11-16 "AN ADMIN-HIDDEN SHOP IS PAUSED FOR EVERYTHING NEW"). While set: the shop is in no list (is_findable), takes no NEW ask or booking (enforce_booking_requires_verified_vendor), no new client import, and its page reads "This shop is paused". Existing bookings and their chats continue. Written only by set_shop_status(). NULL = open.';
COMMENT ON COLUMN public.vendor_profiles.paused_by IS
  'Who paused the shop: ''supplier'' (its owner or a team admin) or ''admin'' (Setnayan). Only Setnayan lifts a pause Setnayan set. Set and cleared together with paused_at (vendor_profiles_pause_pair_check).';

-- The table-level grant would hand a new column to anon: name the readers instead.
GRANT SELECT (paused_at) ON public.vendor_profiles TO authenticated;
GRANT SELECT (paused_by) ON public.vendor_profiles TO authenticated;
REVOKE SELECT (paused_at) ON public.vendor_profiles FROM anon;
REVOKE SELECT (paused_by) ON public.vendor_profiles FROM anon;

-- ── 2 · nobody writes the pause directly but Setnayan ──────────────────────
-- `authenticated` holds table-level UPDATE and vendor_profiles_owner is FOR ALL on the shop's own row, so a column
-- grant cannot protect these columns — a trigger does (the papers_lapsed_at pattern). Inside set_shop_status()
-- current_user is the function owner, so the door passes.
CREATE OR REPLACE FUNCTION public.guard_vendor_shop_pause()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' AND (NEW.paused_at IS NOT NULL OR NEW.paused_by IS NOT NULL) THEN
      RAISE EXCEPTION 'a shop is paused only through set_shop_status()' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.paused_at IS DISTINCT FROM OLD.paused_at
                             OR NEW.paused_by IS DISTINCT FROM OLD.paused_by) THEN
      RAISE EXCEPTION 'a shop is paused only through set_shop_status()' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_vendor_shop_pause() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_vendor_shop_pause() FROM anon;
REVOKE ALL ON FUNCTION public.guard_vendor_shop_pause() FROM authenticated;

DROP TRIGGER IF EXISTS guard_vendor_shop_pause ON public.vendor_profiles;
CREATE TRIGGER guard_vendor_shop_pause
  BEFORE INSERT OR UPDATE ON public.vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_shop_pause();

-- ── 3 · is_findable: a paused shop is in no list ───────────────────────────
ALTER TABLE public.vendor_profiles
  ALTER COLUMN is_findable SET EXPRESSION AS (
    COALESCE(public_visibility = 'verified' AND verification_state = 'verified' AND paused_at IS NULL, FALSE)
  );

COMMENT ON COLUMN public.vendor_profiles.is_findable IS
  'THE ONE RULE for every couple-facing list (search, Discover, Suppliers › Find, category pages, suggestions) — DECISION_LOG 2026-11-15 (supersedes 2026-11-07 "findable until its first inquiry") + 2026-11-16 (a paused shop is in no list). TRUE = verified (public_visibility AND verification_state verified) and not paused (paused_at IS NULL). A not-yet-verified shop is reached only by its own link or QR. Generated: nothing writes it. Demo shops are filtered separately by is_demo; lapsed papers by papers_current. The app reads it only through apps/web/lib/findable-shop.ts.';

-- ── 4 · the booking gate: a paused shop takes no NEW ask or booking ────────
-- The 20271348170528 body, changed only by the `paused` read and its CASE arm.
CREATE OR REPLACE FUNCTION public.enforce_booking_requires_verified_vendor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed CONSTANT public.vendor_status[] :=
    ARRAY['contracted','deposit_paid','delivered','complete']::public.vendor_status[];
  v_booking    BOOLEAN;
  v_asking     BOOLEAN;
  v_state      TEXT;
  v_visibility TEXT;
  v_suspended  TIMESTAMPTZ;
  v_banned     TIMESTAMPTZ;
  v_paused     TIMESTAMPTZ;
  v_found      BOOLEAN;
  v_reason     TEXT;
BEGIN
  -- Off-platform / manual vendors have no verification concept — never gated.
  IF NEW.marketplace_vendor_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- A NEW booking: the transition INTO a confirmed status. A row that was ALREADY confirmed is grandfathered.
  v_booking := NEW.status = ANY (v_confirmed)
               AND NOT (TG_OP = 'UPDATE' AND OLD.status = ANY (v_confirmed));

  -- A NEW ask: the transition INTO a pending request. A row already pending stays as it is.
  v_asking := NEW.lock_request_state IS NOT DISTINCT FROM 'pending'
              AND NOT (TG_OP = 'UPDATE' AND OLD.lock_request_state IS NOT DISTINCT FROM 'pending');

  IF NOT (v_booking OR v_asking) THEN
    RETURN NEW;
  END IF;

  SELECT vp.verification_state::text, vp.public_visibility::text, vp.fraud_suspended_at, vp.fraud_banned_at,
         vp.paused_at, TRUE
    INTO v_state, v_visibility, v_suspended, v_banned, v_paused, v_found
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = NEW.marketplace_vendor_id;

  -- Fail-closed, ban first (a banned shop is also suspended) — the app's `shopBookingRefusal` order.
  v_reason := CASE
    WHEN v_found IS NOT TRUE                                THEN 'missing'
    WHEN v_banned IS NOT NULL                               THEN 'banned'
    WHEN v_suspended IS NOT NULL                            THEN 'suspended'
    -- 16 Nov: a paused shop (by its team or by Setnayan) takes nothing new, verified or not.
    WHEN v_paused IS NOT NULL                               THEN 'paused'
    -- 15 Nov: a shop Setnayan has not decided yet is booked through its own page — unless it is closed.
    WHEN v_state IN ('unverified', 'pending_review')
         AND v_visibility IS NOT DISTINCT FROM 'archived'   THEN 'not_listed'
    WHEN v_state IN ('unverified', 'pending_review')        THEN NULL
    WHEN v_state IS DISTINCT FROM 'verified'                THEN 'not_verified'
    WHEN v_visibility IS DISTINCT FROM 'verified'           THEN 'not_listed'
    ELSE NULL
  END;

  IF v_reason IS NOT NULL THEN
    RAISE EXCEPTION
      'vendor_not_verified: this vendor cannot be booked (reason=%, marketplace_vendor_id=%, state=%, visibility=%)',
      v_reason, NEW.marketplace_vendor_id, COALESCE(v_state, 'missing'), COALESCE(v_visibility, 'missing')
      USING ERRCODE = 'check_violation',
            HINT = 'A shop can be asked or booked when it is verified and listed, or not yet decided and not closed — and never while paused, fraud-suspended or banned.';
  END IF;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.enforce_booking_requires_verified_vendor() IS
  'Owner 2026-07-24 + Lane G item 1 (2026-11-10) + 2026-11-14 ("Yes, block them") + 2026-11-15 ("We allow booking. Since they can get bookings on their website") + 2026-11-16 ("AN ADMIN-HIDDEN SHOP IS PAUSED FOR EVERYTHING NEW"): a MARKETPLACE vendor can be ASKED (event_vendors.lock_request_state → ''pending'') or BOOKED (status → contracted/deposit_paid/delivered/complete) when it has no fraud suspension or ban, is not paused (paused_at IS NULL) AND either (verification_state = ''verified'' AND public_visibility = ''verified'') or (verification_state IN (''unverified'',''pending_review'') AND public_visibility <> ''archived'') — the app''s shopBookingRefusal (lib/vendor-visibility.ts). Rejected and demoted shops are refused. Fires only on the transition INTO an ask or a booking: existing bookings and existing asks are never re-checked. Off-platform vendors (marketplace_vendor_id IS NULL) are never gated. Refusal: check_violation, message prefix "vendor_not_verified:".';

REVOKE ALL ON FUNCTION public.enforce_booking_requires_verified_vendor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_booking_requires_verified_vendor() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_booking_requires_verified_vendor() FROM authenticated;

-- ── 5 · the one door ───────────────────────────────────────────────────────
-- Refusals are RAISEd with a stable `shop_status:<reason>` prefix (errcode 42501 for who-may, P0001 for a rule),
-- which apps/web/lib/shop-status.ts reads back into words. Returns the shop's status after the call.
CREATE OR REPLACE FUNCTION public.set_shop_status(p_vendor_profile_id UUID, p_status TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_is_admin   BOOLEAN := COALESCE(public.is_admin(), FALSE);
  v_owner      UUID;
  v_visibility TEXT;
  v_paused_by  TEXT;
  v_found      BOOLEAN;
  v_is_owner   BOOLEAN;
  v_is_manager BOOLEAN;
  v_open       INT;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('open', 'paused', 'closed') THEN
    RAISE EXCEPTION 'shop_status:bad_status' USING ERRCODE = '22023';
  END IF;
  IF v_uid IS NULL AND NOT v_is_admin THEN
    RAISE EXCEPTION 'shop_status:not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT vp.user_id, vp.public_visibility::text, vp.paused_by, TRUE
    INTO v_owner, v_visibility, v_paused_by, v_found
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = p_vendor_profile_id
   FOR UPDATE;
  IF v_found IS NOT TRUE THEN
    RAISE EXCEPTION 'shop_status:missing' USING ERRCODE = 'P0001';
  END IF;

  v_is_owner := v_uid IS NOT NULL AND (
    v_owner = v_uid
    OR p_vendor_profile_id IN (SELECT public.current_vendor_ids('owner'))
  );
  v_is_manager := v_is_owner OR (v_uid IS NOT NULL AND p_vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

  IF NOT (v_is_admin OR v_is_manager) THEN
    RAISE EXCEPTION 'shop_status:not_allowed' USING ERRCODE = '42501';
  END IF;

  -- A closed shop is reopened by Setnayan's visibility controls, never through this door.
  IF v_visibility = 'archived' THEN
    IF p_status = 'closed' THEN
      RETURN 'closed';
    END IF;
    RAISE EXCEPTION 'shop_status:closed' USING ERRCODE = 'P0001';
  END IF;

  IF p_status = 'paused' THEN
    IF v_is_admin THEN
      UPDATE public.vendor_profiles
         SET paused_at = COALESCE(paused_at, NOW()), paused_by = 'admin', updated_at = NOW()
       WHERE vendor_profile_id = p_vendor_profile_id;
    ELSIF v_paused_by IS NULL THEN
      UPDATE public.vendor_profiles
         SET paused_at = NOW(), paused_by = 'supplier', updated_at = NOW()
       WHERE vendor_profile_id = p_vendor_profile_id;
    END IF;
    -- Already paused by the shop, or by Setnayan: nothing to change (an admin pause is never downgraded).
    RETURN 'paused';
  END IF;

  IF p_status = 'open' THEN
    IF v_paused_by IS NULL THEN
      RETURN 'open';
    END IF;
    IF v_paused_by = 'admin' AND NOT v_is_admin THEN
      RAISE EXCEPTION 'shop_status:paused_by_setnayan' USING ERRCODE = '42501';
    END IF;
    UPDATE public.vendor_profiles
       SET paused_at = NULL, paused_by = NULL, updated_at = NOW()
     WHERE vendor_profile_id = p_vendor_profile_id;
    RETURN 'open';
  END IF;

  -- p_status = 'closed'
  IF NOT v_is_admin THEN
    IF NOT v_is_owner THEN
      RAISE EXCEPTION 'shop_status:owner_only' USING ERRCODE = '42501';
    END IF;
    SELECT count(*)::int INTO v_open
      FROM public.event_vendors ev
     WHERE ev.marketplace_vendor_id = p_vendor_profile_id
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered');
    IF v_open > 0 THEN
      RAISE EXCEPTION 'shop_status:open_bookings:%', v_open USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.vendor_profiles
     SET public_visibility = 'archived', paused_at = NULL, paused_by = NULL, updated_at = NOW()
   WHERE vendor_profile_id = p_vendor_profile_id;
  RETURN 'closed';
END;
$$;

COMMENT ON FUNCTION public.set_shop_status(UUID, TEXT) IS
  'THE ONE DOOR for Shop ⚙ › Shop status and the admin pause/close (owner 2026-10-31 "They can pause and close. Admin can also do that"; 2026-11-16 "AN ADMIN-HIDDEN SHOP IS PAUSED FOR EVERYTHING NEW"). p_status: open | paused | closed. Setnayan (is_admin) may do all three; the shop''s owner or a team admin may pause and reopen their own pause; only the OWNER may close, and only with no open booking (contracted/deposit_paid/delivered). Only Setnayan lifts a pause Setnayan set. Close = public_visibility ''archived'' (the existing closed state); a closed shop is not reopened here. Refusals: message prefix "shop_status:" (read by apps/web/lib/shop-status.ts). Returns the status after the call.';

REVOKE ALL ON FUNCTION public.set_shop_status(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_shop_status(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_shop_status(UUID, TEXT) TO authenticated, service_role;

-- ── 6 · the shop's own view re-projected (its projection is frozen at CREATE) ─
-- The 20271348041863 block verbatim, with the two pause columns added to its anti-vacuity check.
DROP VIEW IF EXISTS public.vendor_profiles_self;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg('vp.' || quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'vendor_profiles';
  IF cols IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed vendor_profiles_self projection is empty';
  END IF;
  IF position('find_locked_at' IN cols) = 0 OR position('is_findable' IN cols) = 0
     OR position('gallery_video_titles' IN cols) = 0
     OR position('papers_lapsed_at' IN cols) = 0 OR position('papers_current' IN cols) = 0
     OR position('paused_at' IN cols) = 0 OR position('paused_by' IN cols) = 0 THEN
    RAISE EXCEPTION 'ANTI-VACUITY FAILED: vendor_profiles_self would not carry the find-lock, video-title, papers or pause columns';
  END IF;
  EXECUTE format($v$
    CREATE VIEW public.vendor_profiles_self
      WITH (security_invoker = false) AS
      SELECT %s
        FROM public.vendor_profiles vp
       WHERE vp.user_id = auth.uid()
          OR vp.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
  $v$, cols);
END $$;

ALTER VIEW public.vendor_profiles_self OWNER TO postgres;
REVOKE ALL ON public.vendor_profiles_self FROM PUBLIC;
REVOKE ALL ON public.vendor_profiles_self FROM anon;
REVOKE ALL ON public.vendor_profiles_self FROM authenticated;
GRANT SELECT ON public.vendor_profiles_self TO authenticated, service_role;

COMMENT ON VIEW public.vendor_profiles_self IS
  'Definer view: the caller''s OWN shops (owner via user_id = auth.uid(), or a '
  'team member via current_vendor_ids(''viewer'')), projecting every '
  'vendor_profiles column INCLUDING the eleven tax/registration/owner-identity '
  'columns that 20271217955839 revoked from `authenticated` at table level. '
  'Predicate mirrors policies vendor_profiles_owner + vendor_profiles_member_read '
  'exactly -- it widens nothing. SELECT ONLY: an auto-updatable definer view '
  'would let a teammate write past vendor_profiles_owner. Admin and public '
  'surfaces do NOT use this -- they read the table on the service-role client.';
