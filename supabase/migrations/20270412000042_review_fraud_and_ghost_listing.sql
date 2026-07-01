-- ============================================================================
-- 20270412000042_review_fraud_and_ghost_listing.sql
--
-- No fake reviews, no ghost listings — the admin-side integrity queue.
--
-- WHAT THIS IS: one detect-and-flag-for-admin-review-ONLY queue table,
-- `integrity_flags`, that holds two deterministic signal families:
--
--   1. REVIEW FRAUD (kind='review_fraud') — a `vendor_reviews` row that scored
--      above threshold on the deterministic screener in
--      apps/web/lib/review-fraud-screener.ts. The screener runs server-side in a
--      Next `after()` task the moment a couple submits a review (NO polling
--      cron), and combines three signals BEYOND the existing 5-signal
--      self-review hard-gate (20260515030000_self_review_gate.sql):
--        · velocity/burst   — many reviews for this vendor in a short window
--        · rating anomaly    — this review's overall rating is far from the
--                              vendor's established norm
--        · reviewer-linkage  — the reviewer shares a device fingerprint
--                              (public.user_devices) with ANOTHER distinct
--                              reviewer of the same vendor (sockpuppet cluster)
--
--   2. GHOST LISTING (kind='ghost_listing') — a marketplace `vendor_profiles`
--      row that scored above threshold on the deterministic detector in
--      apps/web/lib/ghost-listing-detector.ts (placeholder / abandoned /
--      duplicate business identity). Populated by an admin "Rescan" action, NOT
--      a cron.
--
-- This is a MODERATION AID, never an enforcement action. A row landing in the
-- queue NEVER auto-hides a listing, auto-deletes a review, or dings a vendor.
-- The only state changes are an admin's explicit dismiss / confirm-fraud /
-- hide-listing at /admin/integrity-watch.
--
-- RA 10173 (Data Privacy Act) posture: the screener stores only NON-PII derived
-- evidence — numeric scores, a signal label, and small integer counts (e.g.
-- "3 reviews in 48h", "shares a device with 1 other reviewer"). It stores NO
-- device hashes, NO IP addresses, NO review bodies, NO reviewer names. Admins
-- read the linked vendor_reviews / vendor_profiles rows through the existing
-- admin surfaces; this table only points at them.
--
-- RLS: admin-only read + update (mirrors vendor_image_flags /
-- 20270330665855_vendor_image_repost_watch.sql). INSERTs are performed by the
-- service-role admin client from the after()-task screener + the admin rescan
-- action — RLS grants no INSERT to `authenticated`.
--
-- public_id type letter 'Y' (integrity-watch) — the next free letter after
-- A..X (X = latest taken). Y + Z were unused across all migrations.
--
-- KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. integrity_flags — the unified admin review-fraud / ghost-listing queue.
--
--    A row is a single flagged subject:
--      · review_fraud  → subject_review_id points at the suspected vendor_reviews
--        row; subject_vendor_id is that review's vendor (denormalized for the
--        queue's vendor grouping + name lookup).
--      · ghost_listing → subject_vendor_id points at the suspected
--        vendor_profiles row; subject_review_id is NULL.
--
--    `score` (0..100) + `reason` (short machine label) + `detail` (JSONB of the
--    non-PII per-signal breakdown) are computed by the deterministic library
--    functions. `detail` never carries device hashes / IPs / bodies — only
--    counts + booleans + the score components (see the lib comments).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.integrity_flags (
  id                 BIGSERIAL PRIMARY KEY,
  public_id          TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('Y'),
  kind               TEXT NOT NULL
                       CHECK (kind IN ('review_fraud', 'ghost_listing')),

  -- The vendor the flag concerns (always set — the queue groups by vendor).
  subject_vendor_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The specific suspected review (review_fraud only; NULL for ghost_listing).
  subject_review_id  UUID
                       REFERENCES public.vendor_reviews(review_id) ON DELETE CASCADE,

  -- Deterministic 0..100 suspicion score (higher = more suspicious).
  score              SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
  -- Short machine-readable primary reason label (e.g. 'burst_velocity',
  -- 'rating_anomaly', 'reviewer_device_cluster', 'placeholder_listing',
  -- 'duplicate_identity', 'abandoned_listing'). Human copy lives in the lib.
  reason             TEXT NOT NULL,
  -- Non-PII per-signal breakdown (counts, booleans, component scores). NEVER
  -- device hashes / IPs / review bodies / names.
  detail             JSONB NOT NULL DEFAULT '{}'::jsonb,

  status             TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'dismissed', 'confirmed_fraud', 'listing_hidden')),
  resolution_notes   TEXT,
  reviewed_by        UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A review_fraud flag references a specific review — CHECK it's present; a
  -- ghost_listing flag must NOT carry a review reference.
  CONSTRAINT integrity_flags_kind_shape CHECK (
    (kind = 'review_fraud'  AND subject_review_id IS NOT NULL) OR
    (kind = 'ghost_listing' AND subject_review_id IS NULL)
  )
);

-- Dedup: at most ONE open/actioned review-fraud flag per review, and at most
-- ONE per ghost-listing vendor. Partial unique indexes keep re-runs (the
-- after() task re-firing on an edit, or a rescan) from stacking duplicates
-- while still allowing a NULL subject_review_id on ghost rows.
CREATE UNIQUE INDEX IF NOT EXISTS integrity_flags_review_uniq
  ON public.integrity_flags(subject_review_id)
  WHERE kind = 'review_fraud';
CREATE UNIQUE INDEX IF NOT EXISTS integrity_flags_ghost_uniq
  ON public.integrity_flags(subject_vendor_id)
  WHERE kind = 'ghost_listing';

CREATE INDEX IF NOT EXISTS integrity_flags_status_idx
  ON public.integrity_flags(status);
CREATE INDEX IF NOT EXISTS integrity_flags_kind_idx
  ON public.integrity_flags(kind);
CREATE INDEX IF NOT EXISTS integrity_flags_vendor_idx
  ON public.integrity_flags(subject_vendor_id);

ALTER TABLE public.integrity_flags ENABLE ROW LEVEL SECURITY;

-- Admins read everything (the queue + the screener/rescan run admin-side).
DROP POLICY IF EXISTS integrity_flags_admin_read ON public.integrity_flags;
CREATE POLICY integrity_flags_admin_read ON public.integrity_flags
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins resolve flags (dismiss / confirm-fraud / hide-listing).
DROP POLICY IF EXISTS integrity_flags_admin_update ON public.integrity_flags;
CREATE POLICY integrity_flags_admin_update ON public.integrity_flags
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- No INSERT policy for `authenticated`: RLS denies by default. Every insert here
-- is performed with the service-role admin client (createAdminClient), which
-- BYPASSES RLS. HONEST NOTE (mirrors vendor_image_flags): that deny-by-default
-- protects VENDORS + couples from touching the table, but it is NOT the write
-- guard for the feature itself — the real guard is application-level: ONLY the
-- post-review after() screener task and the admin rescan action ever construct
-- that client.

COMMENT ON TABLE public.integrity_flags IS
  'Admin review-fraud + ghost-listing moderation queue. review_fraud rows point '
  'at a suspected vendor_reviews row scored by lib/review-fraud-screener.ts (an '
  'after() task on review submit — NO cron); ghost_listing rows point at a '
  'suspected vendor_profiles row scored by lib/ghost-listing-detector.ts (admin '
  'rescan). Detect-and-review only — never auto-hides/deletes/dings. Admin-only '
  'RLS; all writes via the service-role admin client. detail JSONB carries only '
  'non-PII counts/booleans/score components (RA 10173) — no device hashes, IPs, '
  'bodies, or names. Resolved at /admin/integrity-watch.';

COMMENT ON COLUMN public.integrity_flags.detail IS
  'Non-PII per-signal breakdown (counts, booleans, component scores). NEVER '
  'device hashes, IP addresses, review bodies, or reviewer names.';

COMMIT;
