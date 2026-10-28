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
--   6. The supplier files the notice under its OWN session (INSERT policy +
--      column grant on the four request columns only); the trigger re-derives
--      shop + event from the album row and refuses a hidden/unscreened photo,
--      and a CHECK pins the page ref inside the shop's own folder.
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

-- The supplier files its own notice ("Put on my page", under its OWN session)
-- — but only the four columns that describe the request. The window, the
-- publish and the removal are never the supplier's to write: the BEFORE INSERT
-- trigger stamps them, and no UPDATE/DELETE is granted at all. The trigger also
-- re-derives the shop and the event from the album row, so the WITH CHECK below
-- sees the album's real owner, not what the request claimed.
DROP POLICY IF EXISTS supplier_page_photo_notices_vendor_insert
  ON public.supplier_page_photo_notices;
CREATE POLICY supplier_page_photo_notices_vendor_insert
  ON public.supplier_page_photo_notices
  FOR INSERT TO authenticated
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

REVOKE ALL ON TABLE public.supplier_page_photo_notices FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.supplier_page_photo_notices FROM authenticated;
GRANT INSERT (photo_id, vendor_profile_id, event_id, page_ref)
  ON public.supplier_page_photo_notices TO authenticated;

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
RETURNS TABLE (status TEXT, page_ref TEXT, photo_id UUID)
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
    RETURN QUERY SELECT 'not_found'::text, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  IF n.removed_at IS NULL THEN
    UPDATE public.supplier_page_photo_notices
       SET removed_at = NOW(), removed_by = 'guest'
     WHERE notice_id = n.notice_id;
  END IF;

  -- Pull the ref whether or not the notice was already closed: a Remove must
  -- never leave the photo on the page because an earlier close did not.
  UPDATE public.vendor_profiles
     SET portfolio_r2_keys = array_remove(portfolio_r2_keys, n.page_ref)
   WHERE vendor_profile_id = n.vendor_profile_id
     AND n.page_ref = ANY (COALESCE(portfolio_r2_keys, ARRAY[]::text[]));

  RETURN QUERY SELECT
    CASE WHEN n.removed_at IS NULL THEN 'removed' ELSE 'already' END,
    n.page_ref,
    n.photo_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.remove_supplier_page_photo(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_supplier_page_photo(UUID, UUID) TO service_role;

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
