-- ============================================================================
-- 20270323790338_journal_vendor_spotlights.sql
--
-- Editorial & Journal Spotlights — Wave 5 vendor benefit (the "Soon" editorial
-- recognition program). Credits a vendor inside a published Journal article.
--
-- WHY A DB OVERLAY (not a CMS migration)
--   The Setnayan Journal is FILE/CODE-BASED (apps/web/lib/blog.ts — typed
--   BlogArticle constants, "no DB, no CMS"). We do NOT migrate it. Instead this
--   table is a thin OVERLAY keyed by `blog_slug` (the article's stable slug):
--   admins attach a vendor to an article with a placement, and the public
--   /blog/[slug] page LEFT-JOINs approved overlay rows by slug to render a
--   "Featured partner / In partnership with" credit block. The article body
--   stays in code; only the vendor-crediting overlay lives in the DB.
--
-- PLACEMENTS
--   'featured_partner' — the marquee credit ("Featured partner").       FREE
--   'recommended'      — a softer "In partnership with" mention.        FREE
--   'sponsored'        — a PAID editorial placement. Carries an
--                        unambiguous "Sponsored" badge on the public page
--                        (0038 disclosure rule) AND is gated behind the
--                        two-admin ("four-eyes") approval flow (0023 §9.1)
--                        before it can publish. Its price is admin-managed
--                        in service_catalog (sku_code below) — NEVER hardcoded.
--
-- APPROVAL GATE
--   admin_approved_at IS NULL  → draft, invisible to the public.
--   admin_approved_at NOT NULL → published, public-readable.
--   For 'sponsored' rows, approval is set ONLY by the second admin completing
--   the two-admin handshake (action_type='approve_journal_spotlight' in
--   admin_approval_requests; see apps/web/app/admin/journal-spotlights/actions.ts).
--   For the FREE placements, a single admin sets admin_approved_at directly.
--
-- RLS at CREATE TABLE time. Public read of APPROVED rows only. Admin FOR ALL.
-- ADDITIVE + IDEMPOTENT.
-- ============================================================================

BEGIN;

-- ---- 1. the overlay table --------------------------------------------------

CREATE TABLE IF NOT EXISTS public.journal_vendor_spotlights (
  spotlight_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- S89J-prefixed external handle (the prefix is a soft type hint, not a global
  -- key — the UUID PK + random Crockford body guarantee uniqueness; 'J' is
  -- reused by other tables per the existing convention).
  public_id          TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('J'),
  -- The Journal article this credit attaches to. NOT a FK — the Journal is
  -- file-based (lib/blog.ts), so the slug is validated in app code against the
  -- in-code article registry, not by a database constraint.
  blog_slug          TEXT NOT NULL CHECK (char_length(blog_slug) BETWEEN 1 AND 200),
  vendor_profile_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id)
                       ON DELETE CASCADE,
  placement          TEXT NOT NULL DEFAULT 'featured_partner'
                       CHECK (placement IN ('featured_partner', 'recommended', 'sponsored')),
  -- Mirrors placement='sponsored' for fast public-side badge gating + to make
  -- the "paid slot" intent explicit even if placement vocab grows later. The
  -- public "Sponsored" badge renders when is_sponsored = TRUE.
  is_sponsored       BOOLEAN NOT NULL DEFAULT FALSE,
  -- The admin-managed SKU whose price funds this sponsored slot. NULL for free
  -- placements. Points at service_catalog.sku_code — the price is NEVER stored
  -- here or hardcoded in app code; the app reads service_catalog by this key.
  sponsored_sku_code TEXT
                       REFERENCES public.service_catalog(sku_code) ON DELETE SET NULL,
  -- NULL = draft (admin not approved → invisible to the public). NOT NULL =
  -- approved/published. For sponsored rows this is stamped only by the SECOND
  -- admin in the two-admin handshake.
  admin_approved_at  TIMESTAMPTZ,
  -- Ordering when several vendors are credited on one article (lower first).
  sort_order         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One credit per (article, vendor) — re-attaching the same vendor to the same
  -- article updates the existing row rather than duplicating the credit.
  CONSTRAINT journal_vendor_spotlights_uniq
    UNIQUE (blog_slug, vendor_profile_id)
);

-- Public page reads "approved credits for THIS slug", ordered.
CREATE INDEX IF NOT EXISTS journal_vendor_spotlights_slug_idx
  ON public.journal_vendor_spotlights (blog_slug, sort_order)
  WHERE admin_approved_at IS NOT NULL;
-- Vendor dashboard reads "which approved articles feature ME?".
CREATE INDEX IF NOT EXISTS journal_vendor_spotlights_vendor_idx
  ON public.journal_vendor_spotlights (vendor_profile_id)
  WHERE admin_approved_at IS NOT NULL;

COMMENT ON TABLE public.journal_vendor_spotlights IS
  'Editorial & Journal Spotlights (Wave 5 vendor benefit). DB OVERLAY on the '
  'file-based Journal (apps/web/lib/blog.ts) — joined by blog_slug, NOT a CMS. '
  'Credits a vendor inside a published article. placement free (featured_partner '
  '/ recommended) or paid (sponsored — two-admin gated, carries a "Sponsored" '
  'badge, price from service_catalog.sponsored_sku_code). admin_approved_at IS '
  'NOT NULL gates public visibility.';
COMMENT ON COLUMN public.journal_vendor_spotlights.blog_slug IS
  'Stable slug of the file-based Journal article (lib/blog.ts). Validated in app '
  'code against the in-code registry — intentionally NOT a FK.';
COMMENT ON COLUMN public.journal_vendor_spotlights.is_sponsored IS
  'TRUE for paid placements. Drives the public "Sponsored" disclosure badge '
  '(0038 rule) and requires the two-admin approval handshake before publish.';
COMMENT ON COLUMN public.journal_vendor_spotlights.sponsored_sku_code IS
  'Admin-managed service_catalog SKU funding a sponsored slot. Price lives in '
  'service_catalog (never hardcoded). NULL for free placements.';
COMMENT ON COLUMN public.journal_vendor_spotlights.admin_approved_at IS
  'NULL = draft (hidden). NOT NULL = published. For sponsored rows, set only by '
  'the second admin completing the four-eyes approval (0023 §9.1).';

-- ---- 2. RLS (enabled at create time) ---------------------------------------

ALTER TABLE public.journal_vendor_spotlights ENABLE ROW LEVEL SECURITY;

-- Public read of APPROVED rows ONLY. Draft (unapproved) credits — including
-- pending sponsored slots awaiting the second admin — are invisible to the
-- public. The vendor-dashboard "you're featured" list reads the same approved
-- rows via the vendor's own session client (its index is approved-only too).
DROP POLICY IF EXISTS journal_vendor_spotlights_public_read
  ON public.journal_vendor_spotlights;
CREATE POLICY journal_vendor_spotlights_public_read
  ON public.journal_vendor_spotlights
  FOR SELECT
  USING (admin_approved_at IS NOT NULL);

-- All writes (attach, approve, feature, remove) are admin-only. The admin
-- console actions run with the service-role client (RLS-bypassing) after the
-- app-level requireAdmin() guard; this policy is defense-in-depth and also lets
-- an account_type='admin' session read DRAFT rows for the queue.
DROP POLICY IF EXISTS journal_vendor_spotlights_admin_all
  ON public.journal_vendor_spotlights;
CREATE POLICY journal_vendor_spotlights_admin_all
  ON public.journal_vendor_spotlights
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- 3. updated_at touch trigger -------------------------------------------

-- search_path pinned (immutable) — closes the function_search_path_mutable
-- advisory; a touch trigger needs no schema resolution beyond public.
CREATE OR REPLACE FUNCTION public.touch_journal_vendor_spotlights_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_vendor_spotlights_updated_at
  ON public.journal_vendor_spotlights;
CREATE TRIGGER trg_journal_vendor_spotlights_updated_at
  BEFORE UPDATE ON public.journal_vendor_spotlights
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_journal_vendor_spotlights_updated_at();

-- ---- 4. extend the two-admin approval gate for sponsored slots -------------
--
-- The four-eyes queue (admin_approval_requests, migration 20260930000000)
-- governs major decisions via a CHECK-constrained action_type. Add the journal
-- sponsored-slot action so a paid placement can never publish on one admin's
-- say-so. The flow mirrors approve_vendor_partnership: first admin INSERTs a
-- pending row with target_id = the spotlight_id; a DIFFERENT admin confirms (the
-- atomic .neq('initiated_by', me) claim), which stamps admin_approved_at. The
-- executor lives in apps/web/app/admin/journal-spotlights/actions.ts — it does
-- NOT route through /admin/approvals, so that surface is untouched.

ALTER TABLE public.admin_approval_requests
  DROP CONSTRAINT IF EXISTS admin_approval_requests_action_type_check;

ALTER TABLE public.admin_approval_requests
  ADD CONSTRAINT admin_approval_requests_action_type_check
  CHECK (action_type IN (
    'grant_internal_account',
    'grant_team_pool',
    'promote_to_admin',
    'approve_vendor_partnership',
    'approve_journal_spotlight'
  ));

-- ---- 5. admin-managed SKU for the sponsored slot ---------------------------
--
-- Price lives in service_catalog (admin-managed) — the app reads it by this
-- sku_code and NEVER hardcodes the amount. Seeded is_active=FALSE: like the
-- Spotlight Awards homepage gate, PAID sponsored placement awaits owner
-- sign-off before it can be sold. The placeholder price is PROVISIONAL — an
-- admin sets the real figure in the pricing catalog. ON CONFLICT keeps any
-- admin-edited price/state if this migration re-runs.

INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, purchaser_role, is_active, spec_corpus_ref)
VALUES
  ('journal_sponsored_spotlight',
   'Journal Sponsored Spotlight',
   'A paid, clearly-labelled sponsored editorial placement crediting a vendor '
   'inside a published Setnayan Journal article. Price is admin-managed; '
   'placement is gated behind two-admin approval and carries a Sponsored badge.',
   'editorial', 0, 'placement',
   TRUE, 'vendor', FALSE, '0038 Editorial & Affiliates')
ON CONFLICT (sku_code) DO NOTHING;

COMMIT;
