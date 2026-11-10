-- portfolio photo views
-- ============================================================================
-- 👁 PORTFOLIO PHOTOS COUNT THEIR VIEWS (Build 3 Lane E, item 11 · DECISION_LOG
-- 2026-11-09 👁). Owner, verbatim: "Add it. Count the views."
--
-- Today's hero is "the most viewed photo upload on their portfolio". Until this
-- migration NOTHING counted a photo: `vendor_profile_views` counts the SHOP, and
-- the only `view_count` in the tree is on `creator_chapters`. The portfolio has
-- no table of its own — a photo is one entry of `vendor_profiles.portfolio_r2_keys`
-- (20260514130000_vendor_portfolio.sql) — so a view is keyed on
-- (vendor_profile_id, photo_key) with photo_key = that entry, verbatim.
--
-- THE RULES (owner, file 04 item 11):
--   · a view = a couple/guest opening that photo on the public shop or in
--     Suppliers › Find;
--   · the supplier's own views (owner + team) and admin views NEVER count;
--   · one count per viewer per photo per day — deduped server-side;
--   · written through ONE security-definer RPC, never a client UPDATE;
--   · one cheap increment per open, no read-modify-write.
--
-- SHAPE:
--   1. vendor_portfolio_photo_view_days — the dedupe ledger: one row per
--      (shop, photo, viewer, Manila day). The viewer is HASHED
--      (sha256(salt || id), `lib/vendor-funnel.ts` hashViewer) exactly like
--      `vendor_profile_views` — never a raw user id (behavioral-data lock).
--   2. vendor_portfolio_photo_views — the running count per photo. Bumped by
--      `views = views + 1` in the same statement that inserts (an atomic
--      UPSERT, never read → add → write).
--   3. record_portfolio_photo_view(...) — the ONE writer. SERVICE ROLE ONLY:
--      the server action (`lib/record-portfolio-photo-view.ts`) hashes the
--      viewer and passes the signed-in user id (or null) so the function can
--      refuse the shop's own people and admins. anon/authenticated cannot call
--      it, so nobody can mint views with made-up viewer hashes.
--
-- RLS AT CREATE TIME. The shop reads its own counts; admin reads all; nobody
-- writes but the function. NEVER APPLIED BY HAND — the pipeline pushes it.
-- KEEP IDEMPOTENT.
-- ============================================================================

BEGIN;

-- ── 1 · THE DEDUPE LEDGER ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_portfolio_photo_view_days (
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  photo_key         TEXT NOT NULL CHECK (length(photo_key) BETWEEN 1 AND 1024),
  viewer_hash       TEXT NOT NULL CHECK (viewer_hash ~ '^[0-9a-f]{64}$'),
  viewed_on         DATE NOT NULL,
  PRIMARY KEY (vendor_profile_id, photo_key, viewer_hash, viewed_on)
);

COMMENT ON TABLE public.vendor_portfolio_photo_view_days IS
  'Lane E 👁 — the dedupe ledger behind vendor_portfolio_photo_views: one row per shop, portfolio photo, HASHED viewer and Manila day. Written only by record_portfolio_photo_view(); the viewer is sha256(salt||id), never a raw id.';

ALTER TABLE public.vendor_portfolio_photo_view_days ENABLE ROW LEVEL SECURITY;

-- No policy at all: nobody but the function (and the service role) touches the
-- ledger. Closed to anon and authenticated at the grant too (the second lock).
REVOKE ALL ON TABLE public.vendor_portfolio_photo_view_days FROM PUBLIC, anon, authenticated;

-- ── 2 · THE COUNT PER PHOTO ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_portfolio_photo_views (
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  photo_key         TEXT NOT NULL CHECK (length(photo_key) BETWEEN 1 AND 1024),
  views             BIGINT NOT NULL DEFAULT 0 CHECK (views >= 0),
  last_viewed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (vendor_profile_id, photo_key)
);

COMMENT ON TABLE public.vendor_portfolio_photo_views IS
  'Lane E 👁 — how many distinct viewer-days opened each portfolio photo (vendor_profiles.portfolio_r2_keys entry). Today''s hero shows the most-viewed one (ties → latest). Written only by record_portfolio_photo_view().';

-- "Most viewed" reads one shop's rows ordered by views.
CREATE INDEX IF NOT EXISTS vendor_portfolio_photo_views_top_idx
  ON public.vendor_portfolio_photo_views (vendor_profile_id, views DESC);

ALTER TABLE public.vendor_portfolio_photo_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_portfolio_photo_views_vendor_read ON public.vendor_portfolio_photo_views;
CREATE POLICY vendor_portfolio_photo_views_vendor_read
  ON public.vendor_portfolio_photo_views FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_portfolio_photo_views_admin_read ON public.vendor_portfolio_photo_views;
CREATE POLICY vendor_portfolio_photo_views_admin_read
  ON public.vendor_portfolio_photo_views FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

-- Signed-out visitors never read a shop's counts; signed-in readers are scoped by
-- the policies above. No INSERT/UPDATE/DELETE grant for either.
REVOKE ALL ON TABLE public.vendor_portfolio_photo_views FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.vendor_portfolio_photo_views TO authenticated;

-- ── 3 · THE ONE WRITER ───────────────────────────────────────────────────────
-- Returns TRUE when the open counted, FALSE when it was refused (own shop, admin,
-- not a photo of this shop) or already counted today for this viewer.
CREATE OR REPLACE FUNCTION public.record_portfolio_photo_view(
  p_vendor_profile_id UUID,
  p_photo_key         TEXT,
  p_viewer_hash       TEXT,
  p_viewer_user_id    UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_new   INTEGER;
BEGIN
  IF p_vendor_profile_id IS NULL OR p_photo_key IS NULL OR p_viewer_hash IS NULL
     OR p_viewer_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN FALSE;
  END IF;

  -- The shop's own people (owner or any team member) and admins never count.
  IF p_viewer_user_id IS NOT NULL AND (
       EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = p_viewer_user_id AND u.account_type = 'admin')
    OR EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = p_vendor_profile_id AND vp.user_id = p_viewer_user_id)
    OR EXISTS (SELECT 1 FROM public.vendor_team_members tm WHERE tm.vendor_profile_id = p_vendor_profile_id AND tm.user_id = p_viewer_user_id)
  ) THEN
    RETURN FALSE;
  END IF;

  -- Only a photo that is on this shop's portfolio right now.
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    WHERE vp.vendor_profile_id = p_vendor_profile_id
      AND p_photo_key = ANY (vp.portfolio_r2_keys)
  ) THEN
    RETURN FALSE;
  END IF;

  -- One per viewer per photo per day.
  INSERT INTO public.vendor_portfolio_photo_view_days (vendor_profile_id, photo_key, viewer_hash, viewed_on)
  VALUES (p_vendor_profile_id, p_photo_key, p_viewer_hash, v_today)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_new = ROW_COUNT;
  IF v_new = 0 THEN
    RETURN FALSE;
  END IF;

  -- The increment: one atomic upsert, never read → add → write.
  INSERT INTO public.vendor_portfolio_photo_views AS v (vendor_profile_id, photo_key, views, last_viewed_at)
  VALUES (p_vendor_profile_id, p_photo_key, 1, now())
  ON CONFLICT (vendor_profile_id, photo_key)
  DO UPDATE SET views = v.views + 1, last_viewed_at = now();

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.record_portfolio_photo_view(UUID, TEXT, TEXT, UUID) IS
  'Lane E 👁 — the ONE writer of portfolio photo views. Service role only (lib/record-portfolio-photo-view.ts hashes the viewer). Refuses the shop''s own people and admins; one per viewer per photo per Manila day; atomic increment.';

REVOKE ALL ON FUNCTION public.record_portfolio_photo_view(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_portfolio_photo_view(UUID, TEXT, TEXT, UUID) TO service_role;

COMMIT;
