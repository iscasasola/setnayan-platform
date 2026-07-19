-- ============================================================================
-- 20270321399479_vendor_spotlight_awards.sql
--
-- Spotlight Awards — Wave 5 vendor benefit (the "Soon" recognition program).
--
-- WHAT THIS PERSISTS
--   The badge engine in apps/web/lib/vendor-badges.ts already computes the
--   `top_pick` (top 5% by review-weighted score `avg_rating × ln(reviews+1)`)
--   and `most_booking` (top 10% by completed bookings) badges LIVE per page
--   load — they were never stored. Spotlight Awards turns those organic monthly
--   winners into a CURATED, PERSISTED record: one row per (vendor, award_type,
--   period_month). Persisting them lets us
--     • show an awarded vendor a "You earned a Spotlight Award" banner,
--     • let an admin confirm / override the auto-picks, and
--     • optionally feature a hand-picked subset on the homepage.
--
-- RECOMPUTE IS CRON-FREE. There is no poller. The current-period snapshot is
-- written by a server action (admin "Run now") that calls computeVendorBadges()
-- and UPSERTs winners on the UNIQUE key below — see
-- apps/web/lib/spotlight-awards.ts. (It can also piggyback on admin traffic via
-- Next 15 after(); never a scheduled cron.)
--
-- AWARD TYPES
--   'top_pick'   ← computeVendorBadges() `top_pick`   (review-weighted top 5%)
--   'most_booked'← computeVendorBadges() `most_booking`(completed-booking top10%)
--   'rising'     ← reserved for a future "fastest-growing" pick. No auto-writer
--                  yet; an admin may award it manually (awarded_by='admin').
--
-- HOMEPAGE GATING (⚠ owner sign-off pending)
--   `is_homepage_featured` defaults FALSE. The homepage Spotlight strip renders
--   ONLY rows where an admin has explicitly flipped this TRUE. Nothing is
--   auto-injected onto the live homepage; absent featured rows, the strip
--   renders nothing.
--
-- RLS at CREATE TABLE time. Public read (USING TRUE — the row is an aggregate
-- recognition record, no PII; the homepage + vendor banner are public/vendor
-- surfaces). Admin FOR ALL via public.is_admin(). ADDITIVE + IDEMPOTENT.
-- ============================================================================

BEGIN;

-- ---- 1. the awards table ---------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_spotlight_awards (
  -- award_id is the canonical PK per the Wave 5 brief (UUID), generated
  -- server-side. public_id is the S89-prefixed external handle.
  award_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id          TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('W'),
  vendor_profile_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id)
                       ON DELETE CASCADE,
  award_type         TEXT NOT NULL
                       CHECK (award_type IN ('top_pick', 'most_booked', 'rising')),
  -- The award period. Always stored as the FIRST day of the month (e.g.
  -- 2026-06-01) so the UNIQUE key dedups per calendar month regardless of the
  -- day the recompute ran.
  period_month       DATE NOT NULL,
  awarded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 'auto' = written by the badge-engine snapshot; 'admin' = confirmed,
  -- overridden, or hand-added by a Setnayan Team member in the console.
  awarded_by         TEXT NOT NULL DEFAULT 'auto'
                       CHECK (awarded_by IN ('auto', 'admin')),
  -- Homepage strip gate. FALSE by default — nothing reaches the live homepage
  -- until an admin explicitly features it. See HOMEPAGE GATING note above.
  is_homepage_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One award of a given type per vendor per month. The recompute UPSERTs on
  -- this key (idempotent re-runs in the same month overwrite, never duplicate).
  CONSTRAINT vendor_spotlight_awards_uniq
    UNIQUE (vendor_profile_id, award_type, period_month)
);

-- Current-period lookups ("who won this month?") scan by period_month; the
-- homepage strip additionally filters is_homepage_featured.
CREATE INDEX IF NOT EXISTS vendor_spotlight_awards_period_idx
  ON public.vendor_spotlight_awards (period_month DESC);
CREATE INDEX IF NOT EXISTS vendor_spotlight_awards_featured_idx
  ON public.vendor_spotlight_awards (period_month DESC)
  WHERE is_homepage_featured;
-- The vendor-dashboard banner reads "do I have any award?" by vendor.
CREATE INDEX IF NOT EXISTS vendor_spotlight_awards_vendor_idx
  ON public.vendor_spotlight_awards (vendor_profile_id, period_month DESC);

COMMENT ON TABLE public.vendor_spotlight_awards IS
  'Spotlight Awards (Wave 5 vendor benefit). Persisted monthly recognition '
  'snapshot of the organic top_pick / most_booked badges (+ manual rising) '
  'computed by apps/web/lib/vendor-badges.ts. One row per (vendor, '
  'award_type, period_month). Recompute is cron-free (admin Run-now server '
  'action / Next after()). is_homepage_featured gates the homepage strip — '
  'admin-flipped only, never auto-injected.';
COMMENT ON COLUMN public.vendor_spotlight_awards.period_month IS
  'First day of the award calendar month (UNIQUE-key bucket). Stored as a '
  'DATE truncated to month-start so re-runs within a month dedup.';
COMMENT ON COLUMN public.vendor_spotlight_awards.awarded_by IS
  'auto = badge-engine snapshot; admin = confirmed / overridden / hand-added '
  'in the Setnayan HQ Spotlight Awards console.';
COMMENT ON COLUMN public.vendor_spotlight_awards.is_homepage_featured IS
  'Homepage strip gate. FALSE by default; the marketing homepage Spotlight '
  'strip renders ONLY featured rows. Owner sign-off pending before any '
  'vendor reaches the live homepage.';

-- ---- 2. RLS (enabled at create time) ---------------------------------------

ALTER TABLE public.vendor_spotlight_awards ENABLE ROW LEVEL SECURITY;

-- Public read. The row is an aggregate recognition record (no PII) and feeds
-- two public/vendor surfaces (homepage strip + awarded-vendor banner). The
-- homepage strip further self-gates to is_homepage_featured in app code; the
-- vendor banner is keyed to the vendor's own profile in app code. USING TRUE
-- is aggregate-safe per the brief.
DROP POLICY IF EXISTS vendor_spotlight_awards_public_read
  ON public.vendor_spotlight_awards;
CREATE POLICY vendor_spotlight_awards_public_read
  ON public.vendor_spotlight_awards
  FOR SELECT
  USING (TRUE);

-- All writes (snapshot UPSERT, confirm/override, feature toggle) are admin-only.
-- The recompute server action runs with the service role (bypasses RLS); admins
-- also curate through the console. No self-grant path — a vendor can never
-- award themselves.
DROP POLICY IF EXISTS vendor_spotlight_awards_admin_write
  ON public.vendor_spotlight_awards;
CREATE POLICY vendor_spotlight_awards_admin_write
  ON public.vendor_spotlight_awards
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- 3. updated_at touch trigger -------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_vendor_spotlight_awards_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_spotlight_awards_updated_at
  ON public.vendor_spotlight_awards;
CREATE TRIGGER trg_vendor_spotlight_awards_updated_at
  BEFORE UPDATE ON public.vendor_spotlight_awards
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_vendor_spotlight_awards_updated_at();

COMMIT;
