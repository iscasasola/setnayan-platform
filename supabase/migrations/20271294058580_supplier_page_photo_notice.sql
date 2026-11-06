-- supplier_page_photo_notice
-- ============================================================================
-- A SUPPLIER'S EVENT PHOTO REACHES ITS PUBLIC PAGE ONLY AFTER THE GUESTS HAVE
-- HAD 7 DAYS' NOTICE — AND A TAKEDOWN PULLS IT BACK OFF.
--
-- Owner rulings (corpus DECISION_LOG.md):
--   · 2026-10-03 "A SUPPLIER'S OWN PAPIC PHOTOS GO ON ITS PORTFOLIO AUTOMATICALLY
--     AFTER A 7-DAY GUEST NOTICE — NO COUPLE ALLOW": each guest pictured is told
--     once, in their Event Hub; no Remove within 7 days → public; Remove keeps
--     working afterwards and pulls it from the page.
--   · 2026-10-03 "CHALLENGE PHOTOS … WITH NO RECOGNISED FACES, EVERY GUEST GETS
--     THE ONE-LINE 7-DAY NOTICE" (2): when nobody is tagged, every guest of the
--     event is told.
--   · 2026-10-28 "OWNER: Agree to all" (1): honouring a takedown also removes
--     supplier-held copies, + the 7-day guest notice before a supplier posts a
--     guest photo. In-app only (no new email).
--
-- WHAT WAS TRUE BEFORE THIS FILE
--   "Put on my page" (`putAlbumPhotoOnMyPage`, 2026-10-15) COPIED an album photo
--   (`vendor_papic_portfolio_photos`) into the shop's media folder and appended
--   the copy's ref to `vendor_profiles.portfolio_r2_keys` — public the same
--   second, with no notice to anybody in it. And a takedown, which hides the
--   ALBUM row (`hidden_at`, TD-1), never touched the page copy: the photo came
--   off the album and stayed on the supplier's public page.
--
-- WHAT THIS FILE ADDS
--   1. `supplier_page_photo_notices` — one row per album photo a supplier asked
--      to put on its page. The page ref is NOT in `portfolio_r2_keys` while the
--      notice runs; `publish_supplier_page_photo` appends it only once
--      `public_from` has passed, nothing removed it, and the album row is not
--      hidden.
--   2. THE WINDOW CANNOT BE SHORTENED. A BEFORE INSERT trigger stamps
--      `noticed_at := now()` and `public_from := now() + 7 days` whatever the
--      caller sent, and a CHECK pins `public_from >= noticed_at + 7 days`.
--   3. A TAKEDOWN REACHES THE PAGE COPY. An AFTER UPDATE trigger on the album:
--      the moment a row's `hidden_at` is set (a moderator honouring a takedown,
--      an NSFW block — any hide), its notice is closed and its page ref is
--      removed from `portfolio_r2_keys` in the same transaction. Whoever hides
--      it, the page follows; no caller has to remember.
--   4. `remove_supplier_page_photo` — the guest's Remove (via the guest-session
--      gated server action, service role) closes the notice and pulls the ref.
--   5. BACKFILL: every from-album ref already on a page was published with NO
--      notice. A hidden album row's ref is pulled now (the live leak); a visible
--      one is taken off and given the notice it never had — it returns by
--      itself after 7 days unless somebody in it removes it.
--   6. `file_supplier_page_notice` — the ONE door a notice is filed through,
--      called under the supplier's OWN session (owner-only, like
--      `shop_portfolio_commit`). Under the shop wallet's per-shop lock it
--      prices the photo exactly as the gallery's own save does — the free room
--      (50, or the shop's personal-invite allowance), then 1 credit a photo
--      from the shop wallet (owner 2026-10-23) — with the photos still WAITING
--      counted toward the free room, and files the notice. The charge is taken
--      at the tap (`shop_papic_wallet_spend`, spend_ref `page-notice:<id>`), so
--      the publish never charges and nothing goes up unpaid. A charge the
--      wallet cannot cover files nothing. The trigger re-derives shop + event
--      from the album row and refuses a hidden/unscreened photo, and a CHECK
--      pins the page ref inside the shop's own folder.
--
-- ⚠ R2 OBJECTS: SQL cannot delete a file. The server deletes the page copy
--   after a Remove or a honoured takedown (lib/supplier-page-notice.server.ts);
--   the backfill leaves any copy it pulled unreferenced (its key carries a
--   random uuid and nothing signs it once no ref names it).
--
-- KEEP IDEMPOTENT (may be re-applied).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.supplier_page_photo_notices (
  notice_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One notice per album photo, ever: a photo a guest removed cannot be
  -- re-posted by tapping again (the UNIQUE refuses the second row).
  photo_id          UUID NOT NULL UNIQUE
                      REFERENCES public.vendor_papic_portfolio_photos(photo_id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id          UUID NOT NULL
                      REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The ref the page gallery will carry (`r2://setnayan-media/vendors/{shop}/portfolio/from-album/…`).
  page_ref          TEXT NOT NULL,
  noticed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  public_from       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  published_at      TIMESTAMPTZ,
  removed_at        TIMESTAMPTZ,
  removed_by        TEXT,
  CONSTRAINT supplier_page_photo_notices_seven_days
    CHECK (public_from >= noticed_at + INTERVAL '7 days'),
  CONSTRAINT supplier_page_photo_notices_not_early
    CHECK (published_at IS NULL OR published_at >= public_from),
  CONSTRAINT supplier_page_photo_notices_removed_by
    CHECK (removed_by IS NULL OR removed_by IN ('guest', 'takedown')),
  CONSTRAINT supplier_page_photo_notices_removed_pair
    CHECK ((removed_at IS NULL) = (removed_by IS NULL)),
  -- SEC-1 tenancy, in the row: the ref the publish will append can only name a
  -- file inside THIS shop's own page folder — never another shop's, never a
  -- traversal. `publish_supplier_page_photo` runs as definer, so this is what
  -- stops a hand-written row from posting a stranger's file.
  CONSTRAINT supplier_page_photo_notices_own_folder
    CHECK (
      page_ref LIKE 'r2://setnayan-media/vendors/' || vendor_profile_id::text || '/portfolio/from-album/_%'
      AND position('..' IN page_ref) = 0
    )
);

CREATE INDEX IF NOT EXISTS supplier_page_photo_notices_event_idx
  ON public.supplier_page_photo_notices (event_id, vendor_profile_id);
CREATE INDEX IF NOT EXISTS supplier_page_photo_notices_vendor_idx
  ON public.supplier_page_photo_notices (vendor_profile_id);
CREATE INDEX IF NOT EXISTS supplier_page_photo_notices_due_idx
  ON public.supplier_page_photo_notices (public_from)
  WHERE published_at IS NULL AND removed_at IS NULL;

COMMENT ON TABLE public.supplier_page_photo_notices IS
  'A supplier''s album photo waiting to go on its public page: the event''s guests '
  'are told in their Event Hub and have 7 days to Remove it (owner 2026-10-03). '
  'The page ref enters vendor_profiles.portfolio_r2_keys only via '
  'publish_supplier_page_photo after public_from; a guest Remove or any hide of '
  'the album row pulls it back off.';

ALTER TABLE public.supplier_page_photo_notices ENABLE ROW LEVEL SECURITY;

-- The supplier reads its own notices (the album tile says "Goes up Nov 4");
-- admin reads all. Guests never read this table with their own client — the
-- Event Hub has no Supabase session for a guest; the server reads it on the
-- service role after the guest-session cookie proves the event.
DROP POLICY IF EXISTS supplier_page_photo_notices_vendor_read
  ON public.supplier_page_photo_notices;
CREATE POLICY supplier_page_photo_notices_vendor_read
  ON public.supplier_page_photo_notices
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())
  );

-- No write policy and no write grant for anybody's session: a notice is filed
-- ONLY through `file_supplier_page_notice` (below), which prices it against
-- the shop wallet under the wallet's own lock. A direct INSERT would put a
-- photo on the page without the charge past the free room (owner 2026-10-23).
REVOKE ALL ON TABLE public.supplier_page_photo_notices FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.supplier_page_photo_notices FROM authenticated;
DROP POLICY IF EXISTS supplier_page_photo_notices_vendor_insert
  ON public.supplier_page_photo_notices;

-- ── 2 · THE WINDOW IS STAMPED, NEVER SUPPLIED ───────────────────────────────
CREATE OR REPLACE FUNCTION public.supplier_page_notice_stamps_the_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a RECORD;
BEGIN
  SELECT p.vendor_profile_id, p.event_id, p.hidden_at, p.nsfw_checked
    INTO a
    FROM public.vendor_papic_portfolio_photos p
   WHERE p.photo_id = NEW.photo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'supplier_page_photo_notices: no such album photo' USING ERRCODE = '23503';
  END IF;
  IF a.hidden_at IS NOT NULL OR a.nsfw_checked IS NOT TRUE THEN
    RAISE EXCEPTION 'supplier_page_photo_notices: that photo cannot go on a page' USING ERRCODE = '23514';
  END IF;
  NEW.vendor_profile_id := a.vendor_profile_id;
  NEW.event_id     := a.event_id;
  NEW.removed_at   := NULL;
  NEW.removed_by   := NULL;
  NEW.noticed_at   := NOW();
  NEW.public_from  := NOW() + INTERVAL '7 days';
  NEW.published_at := NULL;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.supplier_page_notice_stamps_the_window() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS supplier_page_notice_stamps_the_window
  ON public.supplier_page_photo_notices;
CREATE TRIGGER supplier_page_notice_stamps_the_window
  BEFORE INSERT ON public.supplier_page_photo_notices
  FOR EACH ROW EXECUTE FUNCTION public.supplier_page_notice_stamps_the_window();

-- ── 3 · ANY HIDE OF THE ALBUM ROW PULLS THE PAGE COPY ───────────────────────
CREATE OR REPLACE FUNCTION public.a_hidden_album_photo_leaves_the_page()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ref TEXT;
BEGIN
  UPDATE public.supplier_page_photo_notices
     SET removed_at = NOW(), removed_by = 'takedown'
   WHERE photo_id = NEW.photo_id
     AND removed_at IS NULL;

  SELECT sn.page_ref INTO v_ref
    FROM public.supplier_page_photo_notices sn
   WHERE sn.photo_id = NEW.photo_id;

  IF v_ref IS NOT NULL THEN
    UPDATE public.vendor_profiles
       SET portfolio_r2_keys = array_remove(portfolio_r2_keys, v_ref)
     WHERE vendor_profile_id = NEW.vendor_profile_id
       AND v_ref = ANY (COALESCE(portfolio_r2_keys, ARRAY[]::text[]));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.a_hidden_album_photo_leaves_the_page() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS a_hidden_album_photo_leaves_the_page
  ON public.vendor_papic_portfolio_photos;
CREATE TRIGGER a_hidden_album_photo_leaves_the_page
  AFTER UPDATE OF hidden_at ON public.vendor_papic_portfolio_photos
  FOR EACH ROW
  WHEN (OLD.hidden_at IS NULL AND NEW.hidden_at IS NOT NULL)
  EXECUTE FUNCTION public.a_hidden_album_photo_leaves_the_page();

-- ── 1 · PUBLISH — only after the window, only if nothing removed it ─────────
-- Returns TRUE when the ref is (now, or already) on the page; FALSE when the
-- notice is not due, was removed, or its album photo is hidden — the caller
-- then deletes the copy it made.
CREATE OR REPLACE FUNCTION public.publish_supplier_page_photo(p_notice_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n RECORD;
BEGIN
  SELECT sn.notice_id, sn.vendor_profile_id, sn.page_ref, sn.public_from,
         sn.published_at, sn.removed_at, p.hidden_at
    INTO n
    FROM public.supplier_page_photo_notices sn
    JOIN public.vendor_papic_portfolio_photos p ON p.photo_id = sn.photo_id
   WHERE sn.notice_id = p_notice_id
   FOR UPDATE OF sn;

  IF NOT FOUND OR n.removed_at IS NOT NULL OR n.hidden_at IS NOT NULL THEN
    RETURN FALSE;
  END IF;
  IF n.published_at IS NOT NULL THEN
    RETURN TRUE;
  END IF;
  IF n.public_from > NOW() THEN
    RETURN FALSE;
  END IF;

  UPDATE public.vendor_profiles
     SET portfolio_r2_keys = COALESCE(portfolio_r2_keys, ARRAY[]::text[]) || n.page_ref
   WHERE vendor_profile_id = n.vendor_profile_id
     AND NOT (n.page_ref = ANY (COALESCE(portfolio_r2_keys, ARRAY[]::text[])));

  UPDATE public.supplier_page_photo_notices
     SET published_at = NOW()
   WHERE notice_id = n.notice_id;
  RETURN TRUE;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.publish_supplier_page_photo(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_supplier_page_photo(UUID) TO service_role;

-- ── 4 · THE GUEST'S REMOVE ──────────────────────────────────────────────────
-- Keyed by the album photo (the id `askToTakeMyPhotoDown` files its takedown
-- against) and bound to the event the guest-session cookie proved
-- (p_event_id), so an id from another event matches nothing. Returns the page
-- ref so the server can delete the copy; status 'removed' | 'already' |
-- 'not_found'.
CREATE OR REPLACE FUNCTION public.remove_supplier_page_photo(p_photo_id UUID, p_event_id UUID)
RETURNS TABLE (status TEXT, page_ref TEXT, photo_id UUID, vendor_profile_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n RECORD;
BEGIN
  SELECT sn.notice_id, sn.vendor_profile_id, sn.page_ref, sn.photo_id, sn.removed_at
    INTO n
    FROM public.supplier_page_photo_notices sn
   WHERE sn.photo_id = p_photo_id
     AND sn.event_id = p_event_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF n.removed_at IS NULL THEN
    UPDATE public.supplier_page_photo_notices sn
       SET removed_at = NOW(), removed_by = 'guest'
     WHERE sn.notice_id = n.notice_id;
  END IF;

  -- Pull the ref whether or not the notice was already closed: a Remove must
  -- never leave the photo on the page because an earlier close did not.
  -- (Qualified: `vendor_profile_id` / `page_ref` are also this function's OUT columns.)
  UPDATE public.vendor_profiles vp
     SET portfolio_r2_keys = array_remove(vp.portfolio_r2_keys, n.page_ref)
   WHERE vp.vendor_profile_id = n.vendor_profile_id
     AND n.page_ref = ANY (COALESCE(vp.portfolio_r2_keys, ARRAY[]::text[]));

  RETURN QUERY SELECT
    CASE WHEN n.removed_at IS NULL THEN 'removed' ELSE 'already' END,
    n.page_ref,
    n.photo_id,
    n.vendor_profile_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.remove_supplier_page_photo(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_supplier_page_photo(UUID, UUID) TO service_role;

-- ── 6 · FILE A NOTICE, PRICED AGAINST THE SHOP WALLET ───────────────────────
-- Returns jsonb: status 'ok' | 'exists' (with the notice's dates) | 'already'
-- (the ref is on the page) | 'insufficient' (charge, balance) | 'not_owner' |
-- 'refused' | 'not_found'. charge = max(0, (before + w) − max(free, before)),
-- before = the page's credits + the waiting notices' credits — the same
-- formula as `shop_portfolio_commit` (charge = after − max(free, kept)), with
-- the waiting photos counted as already kept.
CREATE OR REPLACE FUNCTION public.file_supplier_page_notice(p_photo_id UUID, p_page_ref TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a        RECORD;
  v_owner  UUID;
  v_list   TEXT[];
  v_allow  INTEGER;
  -- The owner's free 50 (2026-10-23) — the same constant `shop_portfolio_commit`
  -- holds, NOT a parameter (a caller that chose it would choose its own price).
  -- Held equal to PORTFOLIO_FREE_CREDITS by lib/supplier-page-notice.test.ts.
  v_base   CONSTANT INTEGER := 50;
  v_free   INTEGER;
  v_before INTEGER := 0;
  v_w      INTEGER;
  v_charge INTEGER;
  v_bal    INTEGER;
  v_ref    TEXT;
  n        RECORD;
  v_spend  jsonb;
BEGIN
  IF p_photo_id IS NULL OR p_page_ref IS NULL OR length(btrim(p_page_ref)) = 0 THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  SELECT p.vendor_profile_id, p.event_id, p.hidden_at, p.nsfw_checked
    INTO a
    FROM public.vendor_papic_portfolio_photos p
   WHERE p.photo_id = p_photo_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- The wallet's own lock: this filing, a gallery save and any other spend for
  -- the same shop take turns.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('shop_papic_wallet:' || a.vendor_profile_id::text, 0));

  SELECT vp.user_id, COALESCE(vp.portfolio_r2_keys, ARRAY[]::TEXT[]), vp.portfolio_photo_allowance
    INTO v_owner, v_list, v_allow
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = a.vendor_profile_id
   FOR UPDATE;
  -- Owner-only, exactly as `shop_portfolio_commit` (it spends the shop's wallet).
  IF v_owner IS DISTINCT FROM auth.uid() AND NOT COALESCE(public.is_admin(), FALSE) THEN
    RETURN jsonb_build_object('status', 'not_owner');
  END IF;
  IF a.hidden_at IS NOT NULL OR a.nsfw_checked IS NOT TRUE THEN
    RETURN jsonb_build_object('status', 'refused');
  END IF;

  SELECT sn.notice_id, sn.public_from, sn.published_at, sn.removed_at, sn.removed_by
    INTO n
    FROM public.supplier_page_photo_notices sn
   WHERE sn.photo_id = p_photo_id;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'exists', 'notice_id', n.notice_id, 'public_from', n.public_from,
      'published_at', n.published_at, 'removed_at', n.removed_at, 'removed_by', n.removed_by, 'charged', 0);
  END IF;
  IF p_page_ref = ANY (v_list) THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  v_free := GREATEST(v_base, COALESCE(v_allow, 0));
  FOR v_ref IN
    SELECT DISTINCT r FROM (
      SELECT unnest(v_list) AS r
      UNION
      SELECT sn.page_ref FROM public.supplier_page_photo_notices sn
       WHERE sn.vendor_profile_id = a.vendor_profile_id
         AND sn.published_at IS NULL AND sn.removed_at IS NULL
    ) x WHERE r IS NOT NULL AND length(btrim(r)) > 0
  LOOP
    v_before := v_before + public.shop_portfolio_ref_credits(v_ref);
  END LOOP;
  v_w := public.shop_portfolio_ref_credits(p_page_ref);
  v_charge := GREATEST(0, v_before + v_w - GREATEST(v_free, v_before));

  IF v_charge > 0 THEN
    SELECT COALESCE(SUM(e.delta), 0)::INTEGER INTO v_bal
      FROM public.shop_papic_wallet_entries e WHERE e.vendor_profile_id = a.vendor_profile_id;
    IF v_bal < v_charge THEN
      RETURN jsonb_build_object('status', 'insufficient', 'charge', v_charge, 'balance', v_bal);
    END IF;
  END IF;

  INSERT INTO public.supplier_page_photo_notices (photo_id, vendor_profile_id, event_id, page_ref)
  VALUES (p_photo_id, a.vendor_profile_id, a.event_id, p_page_ref)
  RETURNING notice_id, public_from, published_at, removed_at, removed_by INTO n;

  IF v_charge > 0 THEN
    v_spend := public.shop_papic_wallet_spend(
      a.vendor_profile_id, v_charge, 'portfolio_spend', 'page-notice:' || n.notice_id::text,
      a.event_id, 1, 0, 'A page photo past the free ' || v_free, auth.uid());
    IF v_spend->>'status' NOT IN ('ok', 'duplicate') THEN
      RAISE EXCEPTION 'file_supplier_page_notice: the wallet refused (%)', v_spend->>'status';
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'notice_id', n.notice_id, 'public_from', n.public_from,
    'published_at', n.published_at, 'removed_at', n.removed_at, 'removed_by', n.removed_by, 'charged', v_charge);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.file_supplier_page_notice(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.file_supplier_page_notice(UUID, TEXT) TO authenticated, service_role;

-- ── 5 · BACKFILL — the photos that went public with no notice ───────────────
-- The page ref is the album key re-homed exactly as `pagePhotoKeyFor`
-- (apps/web/lib/put-photo-on-my-page.ts) names it:
--   r2://setnayan-media/papic/vendor-{shop}/portfolio/{rest}
--     → r2://setnayan-media/vendors/{shop}/portfolio/from-album/{rest with / → -}
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.photo_id, p.vendor_profile_id, p.event_id, p.hidden_at, p.nsfw_checked,
           'r2://setnayan-media/vendors/' || p.vendor_profile_id::text || '/portfolio/from-album/' ||
             replace(
               substr(p.r2_object_key,
                      length('r2://setnayan-media/papic/vendor-' || p.vendor_profile_id::text || '/portfolio/') + 1),
               '/', '-') AS page_ref
      FROM public.vendor_papic_portfolio_photos p
     WHERE p.r2_object_key LIKE 'r2://setnayan-media/papic/vendor-' || p.vendor_profile_id::text || '/portfolio/%'
       AND NOT EXISTS (
         SELECT 1 FROM public.supplier_page_photo_notices sn WHERE sn.photo_id = p.photo_id
       )
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.vendor_profiles v
       WHERE v.vendor_profile_id = r.vendor_profile_id
         AND r.page_ref = ANY (COALESCE(v.portfolio_r2_keys, ARRAY[]::text[]))
    ) THEN
      UPDATE public.vendor_profiles
         SET portfolio_r2_keys = array_remove(portfolio_r2_keys, r.page_ref)
       WHERE vendor_profile_id = r.vendor_profile_id;

      -- A hidden (taken-down, blocked) photo just comes off — there is
      -- nothing to give notice of. A visible one gets the notice it never had.
      IF r.hidden_at IS NULL AND r.nsfw_checked IS TRUE THEN
        INSERT INTO public.supplier_page_photo_notices (photo_id, vendor_profile_id, event_id, page_ref)
        VALUES (r.photo_id, r.vendor_profile_id, r.event_id, r.page_ref);
      END IF;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
