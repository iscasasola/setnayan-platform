-- ============================================================================
-- 20270411213000_vendor_priority_support.sql
-- Priority support — vendor tier → front-of-queue in the /admin/help inbox.
--
-- The help_messages queue (iteration 0029, migration 20260513170000) is today a
-- flat status+created_at inbox: everyone (anon guest, couple, vendor) lands in
-- one undifferentiated FIFO. This adds a NULLABLE priority signal so paying
-- vendors' support requests can be surfaced ahead of the rest.
--
-- WHAT THIS ADDS
-- --------------
--   • help_messages.submitter_vendor_tier TEXT  — nullable. Stamped ONLY on
--     vendor-side submissions (the /help submit action resolves the signed-in
--     submitter's vendor tier via resolveVendorTier and writes it here).
--     Couple/guest/anon submissions leave it NULL.
--   • help_messages.priority_rank SMALLINT      — a GENERATED, always-derived
--     rank from the tier string so the admin queue can ORDER BY it without a
--     tier→rank map living in application code. enterprise>pro>solo>
--     verified/free>NULL. A generated column keeps the rank and the tier string
--     from ever drifting apart, and is null-safe for non-vendor rows (rank 0).
--
-- WHY A COLUMN, NOT A JOIN AT READ TIME
-- -------------------------------------
-- A vendor's tier can change after they submit (upgrade/downgrade/churn). The
-- SUPPORT PRIORITY is a property of the request AT SUBMISSION time — a Pro
-- vendor who wrote in while paying shouldn't drop to the back of the queue if
-- they later downgrade. So we snapshot the tier onto the row, exactly like the
-- rest of help_messages captures point-in-time sender fields. It's also cheaper:
-- the admin queue reads one indexed column instead of joining vendor_profiles +
-- vendor_team_members per row.
--
-- RLS: help_messages already has RLS enabled (20260513170000). This migration is
-- ADD COLUMN only — no new table, no policy change. The public INSERT policy
-- (help_messages_anyone_insert, WITH CHECK true) already permits writing these
-- columns; the admin queue reads them via the service-role client (RLS-bypass),
-- so no SELECT-policy change is needed either.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- Point-in-time snapshot of the submitter's vendor tier. NULL for every
-- non-vendor (couple / guest / anon) submission. Constrained to the known
-- vendor-tier vocabulary so a typo can't silently land an un-rankable value.
ALTER TABLE public.help_messages
  ADD COLUMN IF NOT EXISTS submitter_vendor_tier TEXT
    CHECK (
      submitter_vendor_tier IS NULL
      OR submitter_vendor_tier IN ('free', 'verified', 'solo', 'pro', 'enterprise')
    );

-- Derived numeric rank for ORDER BY. Higher = closer to the front of the queue.
-- Generated (not app-supplied) so it can never disagree with the tier string.
-- NULL tier (non-vendor) and free/verified all collapse to the low end; the
-- paid ladder (solo<pro<enterprise) rises above them.
ALTER TABLE public.help_messages
  ADD COLUMN IF NOT EXISTS priority_rank SMALLINT
    GENERATED ALWAYS AS (
      CASE submitter_vendor_tier
        WHEN 'enterprise' THEN 4
        WHEN 'pro'        THEN 3
        WHEN 'solo'       THEN 2
        WHEN 'verified'   THEN 1
        WHEN 'free'       THEN 1
        ELSE 0
      END
    ) STORED;

-- Queue read order: priority_rank DESC, then created_at DESC (freshest first
-- within a priority band). A composite index backs the exact admin ORDER BY.
CREATE INDEX IF NOT EXISTS help_messages_priority_created_idx
  ON public.help_messages(priority_rank DESC, created_at DESC);

COMMIT;
