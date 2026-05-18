-- ============================================================================
-- 20260518000000_v1_concierge_pay_flat_and_charm.sql
--
-- Bundled V1 launch migration covering three locked-but-unshipped decisions:
--
--  1. Setnayan Concierge V1 (2026-05-17 row 2/3) — single SKU concierge_complete
--     at ₱4,999 with a 3-day card-less trial, one trial per account, and the
--     tiered admin-actioned enforcement ladder. Schema only — server actions
--     and UI ship in the same PR (apps/web/...).
--
--  2. Setnayan Pay flat 5.0% (2026-05-16 row 16) — supersedes the morning's
--     5.5% / 6.5% dual rate. All six method rows in setnayan_pay_methods are
--     repriced in place. Vendor opt-in absorption (2026-05-16 row 17) adds
--     vendors.absorbs_convenience_fee + orders.vendor_absorbed_fee.
--
--  3. Charm-pricing reconciliation (2026-05-17 row 4) — service_catalog rows
--     seeded at round numbers (₱1,500, ₱2,500, ₱5,000, ₱8,000, ₱15,000,
--     ₱250,000, ₱800,000) are updated to the -1 charm form (₱1,499, ₱2,499,
--     ₱4,999, ₱7,999, ₱14,999, ₱249,999, ₱799,999). The flagship Concierge
--     SKU is inserted with the same charm form.
--
-- Idempotent. No drops. Adds-only on existing tables.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Setnayan Concierge — events table additions
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS concierge_status TEXT
    NOT NULL DEFAULT 'diy'
    CHECK (concierge_status IN ('diy', 'trial', 'active', 'expired')),
  ADD COLUMN IF NOT EXISTS concierge_tier TEXT
    CHECK (concierge_tier IN ('complete')),
  ADD COLUMN IF NOT EXISTS concierge_activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS concierge_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS concierge_long_engagement_advised_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS events_concierge_status_idx
  ON public.events(concierge_status)
  WHERE concierge_status <> 'diy';

CREATE INDEX IF NOT EXISTS events_concierge_expires_at_idx
  ON public.events(concierge_expires_at)
  WHERE concierge_expires_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Setnayan Concierge — users table additions (per-account trial + enforcement)
-- ----------------------------------------------------------------------------

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS concierge_trial_used_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS concierge_abuse_strike_count INTEGER NOT NULL DEFAULT 0
                                                        CHECK (concierge_abuse_strike_count >= 0),
  ADD COLUMN IF NOT EXISTS concierge_enforcement_level  TEXT NOT NULL DEFAULT 'none'
                                                        CHECK (concierge_enforcement_level IN
                                                          ('none', 'warning', 'trial_banned', 'full_banned')),
  ADD COLUMN IF NOT EXISTS concierge_enforcement_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS concierge_enforcement_by     UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS concierge_enforcement_reason TEXT;

CREATE INDEX IF NOT EXISTS users_concierge_enforcement_idx
  ON public.users(concierge_enforcement_level)
  WHERE concierge_enforcement_level <> 'none';

-- ----------------------------------------------------------------------------
-- 3. Setnayan Concierge — abuse-flag audit table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.concierge_abuse_flags (
  flag_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_user_id   UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  matched_user_ids  UUID[] NOT NULL DEFAULT '{}',
  similarity_score  NUMERIC NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  signals           JSONB NOT NULL DEFAULT '{}'::jsonb,
  status            TEXT NOT NULL DEFAULT 'pending_review'
                    CHECK (status IN ('pending_review', 'cleared', 'confirmed_abuse')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  admin_notes       TEXT
);

CREATE INDEX IF NOT EXISTS concierge_abuse_flags_status_idx
  ON public.concierge_abuse_flags(status, created_at DESC);

CREATE INDEX IF NOT EXISTS concierge_abuse_flags_flagged_user_idx
  ON public.concierge_abuse_flags(flagged_user_id);

ALTER TABLE public.concierge_abuse_flags ENABLE ROW LEVEL SECURITY;

-- Admin-only read/write. Per § 4.3 of 0023, a single admin can clear or
-- confirm a flag (these are reversible decisions). The is_admin() helper is
-- defined in the base migration.
DROP POLICY IF EXISTS concierge_abuse_flags_admin_read   ON public.concierge_abuse_flags;
DROP POLICY IF EXISTS concierge_abuse_flags_admin_write  ON public.concierge_abuse_flags;
DROP POLICY IF EXISTS concierge_abuse_flags_admin_update ON public.concierge_abuse_flags;

CREATE POLICY concierge_abuse_flags_admin_read
  ON public.concierge_abuse_flags FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY concierge_abuse_flags_admin_write
  ON public.concierge_abuse_flags FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY concierge_abuse_flags_admin_update
  ON public.concierge_abuse_flags FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. Setnayan Pay flat 5.0% — repricing the existing setnayan_pay_methods rows
--    (supersedes the 2026-05-16 morning lock of 5.5%/6.5% dual rate).
-- ----------------------------------------------------------------------------

UPDATE public.setnayan_pay_methods
   SET setnayan_pay_pct = 0.0500,
       updated_at = NOW(),
       notes = COALESCE(notes || ' | ', '')
             || 'Repriced to flat 5.0% on 2026-05-18 per CLAUDE.md decision-log '
             || '2026-05-16 row 16 (supersedes morning 5.5%/6.5% dual-rate).'
 WHERE setnayan_pay_pct <> 0.0500;

-- ----------------------------------------------------------------------------
-- 5. Vendor opt-in fee absorption (2026-05-16 row 17)
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS absorbs_convenience_fee BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS vendor_profiles_absorbs_fee_idx
  ON public.vendor_profiles(absorbs_convenience_fee)
  WHERE absorbs_convenience_fee = TRUE;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS vendor_absorbed_fee BOOLEAN NOT NULL DEFAULT FALSE;

-- ----------------------------------------------------------------------------
-- 6. Charm-pricing reconciliation — service_catalog (2026-05-17 row 4)
--    Round-number prices seeded in 20260516000000 are updated to -1 charm form.
--    is_active stays TRUE; only the price moves.
-- ----------------------------------------------------------------------------

UPDATE public.service_catalog
   SET price_centavos = CASE sku_code
     WHEN 'vendor_verification_annual_renewal' THEN 149900   -- ₱1,500 → ₱1,499
     WHEN 'vendor_verification_redemption'     THEN 249900   -- ₱2,500 → ₱2,499
     WHEN 'boosted_ads_5km'                    THEN 499900   -- ₱5,000 → ₱4,999
     WHEN 'boosted_ads_10km'                   THEN 799900   -- ₱8,000 → ₱7,999
     WHEN 'boosted_ads_20km'                   THEN 1499900  -- ₱15,000 → ₱14,999
     WHEN 'sponsored_boost_quarterly_30km'     THEN 24999900 -- ₱250,000 → ₱249,999
     WHEN 'sponsored_boost_annual_30km'        THEN 79999900 -- ₱800,000 → ₱799,999
     ELSE price_centavos
   END,
   updated_at = NOW()
 WHERE sku_code IN (
   'vendor_verification_annual_renewal',
   'vendor_verification_redemption',
   'boosted_ads_5km',
   'boosted_ads_10km',
   'boosted_ads_20km',
   'sponsored_boost_quarterly_30km',
   'sponsored_boost_annual_30km'
 );

-- ----------------------------------------------------------------------------
-- 7. Concierge flagship SKU — concierge_complete at ₱4,999 (2026-05-17 row 2)
-- ----------------------------------------------------------------------------

INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, subscription, refundable, purchaser_role, is_active,
   spec_corpus_ref)
VALUES
  ('concierge_complete',
   'Setnayan Concierge',
   'Full-service event coordination via Setnayan Concierge. Single SKU at ' ||
   '₱4,999. Access window is wedding-anchored: LEAST(GREATEST(wedding_date '
   '+ 30d, activated_at + 12mo), activated_at + 24mo). Includes 3-day card-' ||
   'less trial (one per account). Auto-renew deferred to V1.5. Per ' ||
   'CLAUDE.md decision-log 2026-05-17 row 2.',
   'concierge', 499900, 'event',
   FALSE, FALSE, TRUE, 'couple', TRUE,
   '2026-05-17 concierge_lock')
ON CONFLICT (sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description  = EXCLUDED.description,
  category     = EXCLUDED.category,
  price_centavos = EXCLUDED.price_centavos,
  unit         = EXCLUDED.unit,
  is_active    = TRUE,
  updated_at   = NOW();

COMMIT;
