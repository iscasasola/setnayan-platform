-- ============================================================================
-- 20260516220000_vendor_ad_subscriptions.sql
-- Iteration 0022 § 5b — Vendor Marketing tier ladder (locked 2026-05-16).
--
-- Tracks a vendor's active purchases of Boosted Ads (weekly by radius) and
-- Sponsored Boost (long-commit, 30km, verified-only). The 5 new SKUs in
-- `service_catalog` (seeded by 20260516000000_v1_sku_lock_service_catalog.sql)
-- are pure pricing rows; this table is the missing per-vendor subscription
-- ledger that powers:
--
--   1. The vendor marketing surface — "what am I currently running, and how
--      much am I paying this week / quarter / year?"
--   2. The admin queue — "who's running what, when does it expire, refund?"
--   3. The DIY-browse extension — "should this vendor's card surface to a
--      couple searching outside the default 10km radius, and which badge
--      does the card carry (terracotta Boosted vs gold Sponsored)?"
--
-- A vendor row is "active" iff `cancelled_at IS NULL AND expires_at > NOW()`.
-- Audit-friendly: a new purchase inserts a fresh row rather than mutating the
-- previous one. The `vendor_active_ads` view collapses the SKU-specific rows
-- into a "what badge / radius applies to this vendor right now" lookup.
--
-- Source of truth: spec corpus commit a0fa3c7 (2026-05-16 Session Summary,
-- 11th sub-bullet of the eighth 2026-05-16 row in CLAUDE.md). Pairs with the
-- service_catalog rows for boosted_ads_5km / _10km / _20km and the verified-
-- only sponsored_boost_quarterly_30km / sponsored_boost_annual_30km SKUs.
--
-- Pricing in PHP centavos (1 peso = 100 centavos), matching service_catalog.
--
-- Idempotent. No drops. Safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- vendor_ad_subscriptions — one row per ad/sponsored-boost purchase period.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_ad_subscriptions (
  ad_subscription_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  vendor_profile_id     UUID NOT NULL
                        REFERENCES public.vendor_profiles(vendor_profile_id)
                        ON DELETE RESTRICT,
    -- RESTRICT — paid ad subscriptions must not silently disappear when a
    -- vendor profile is removed. Admins reconcile / refund first.

  sku_code              TEXT NOT NULL
                        REFERENCES public.service_catalog(sku_code)
                        ON DELETE RESTRICT,
    -- One of:
    --   boosted_ads_5km           — ₱5,000/wk · open to verified
    --   boosted_ads_10km          — ₱8,000/wk · open to verified
    --   boosted_ads_20km          — ₱15,000/wk · open to verified
    --   sponsored_boost_quarterly_30km — ₱250,000/3mo · verified only
    --   sponsored_boost_annual_30km    — ₱800,000/yr · verified only

  radius_km             INTEGER NOT NULL
                        CHECK (radius_km IN (5, 10, 20, 30)),

  gross_centavos        INTEGER NOT NULL
                        CHECK (gross_centavos >= 0),
    -- What the vendor was charged, in PHP centavos. Snapshot at purchase
    -- time so the row stays meaningful even if the SKU is repriced later.

  payment_method_key    TEXT,
    -- Matches setnayan_pay_methods.method_key. NULL = direct/manual flow.

  order_id              UUID
                        REFERENCES public.orders(order_id)
                        ON DELETE SET NULL,
    -- Nullable so admins can comp a subscription without an order (apology
    -- comp after a marketplace outage). The order_id link is the audit
    -- trail when the subscription was bought through the normal cart.

  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ NOT NULL
                        CHECK (expires_at > started_at),
    -- Derived at insert time from `sku_code`:
    --   boosted_ads_*km                 → started_at + 7 days
    --   sponsored_boost_quarterly_30km  → started_at + 90 days
    --   sponsored_boost_annual_30km     → started_at + 365 days

  auto_renew            BOOLEAN NOT NULL DEFAULT FALSE,
    -- Boosted Ads default to weekly auto-renew (vendor opts in at checkout);
    -- Sponsored Boost long-commit defaults to no auto-renew (the vendor
    -- consciously decides to renew the next quarter / year).

  cancelled_at          TIMESTAMPTZ,
  cancel_reason         TEXT,
  refund_centavos       INTEGER CHECK (refund_centavos IS NULL OR refund_centavos >= 0),
    -- Set when the admin issues a partial/full refund alongside cancel.

  cancelled_by_user_id  UUID
                        REFERENCES public.users(user_id)
                        ON DELETE SET NULL,
    -- Who cancelled — vendor self-serve sets this to the vendor; admin
    -- intervention sets this to the admin's user_id.

  notes                 TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_ad_subscriptions_vendor_idx
  ON public.vendor_ad_subscriptions(vendor_profile_id);
CREATE INDEX IF NOT EXISTS vendor_ad_subscriptions_sku_idx
  ON public.vendor_ad_subscriptions(sku_code);
CREATE INDEX IF NOT EXISTS vendor_ad_subscriptions_active_idx
  ON public.vendor_ad_subscriptions(vendor_profile_id, expires_at)
  WHERE cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS vendor_ad_subscriptions_expiring_idx
  ON public.vendor_ad_subscriptions(expires_at)
  WHERE cancelled_at IS NULL;

-- ----------------------------------------------------------------------------
-- vendor_active_ads view — "what badge applies, what radius extends marketplace
-- reach for this vendor right now?". Picks the most-permissive active row
-- per vendor (Sponsored Boost beats Boosted Ads; larger radius beats smaller).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.vendor_active_ads AS
WITH ranked AS (
  SELECT
    vas.vendor_profile_id,
    vas.ad_subscription_id,
    vas.sku_code,
    vas.radius_km,
    vas.expires_at,
    vas.started_at,
    CASE
      WHEN vas.sku_code IN (
        'sponsored_boost_quarterly_30km',
        'sponsored_boost_annual_30km'
      ) THEN 'sponsored'::TEXT
      ELSE 'boosted'::TEXT
    END AS tier,
    -- Sort key: sponsored (rank 2) outranks boosted (rank 1); within the
    -- same tier the larger radius wins, then the latest expiry.
    ROW_NUMBER() OVER (
      PARTITION BY vas.vendor_profile_id
      ORDER BY
        CASE
          WHEN vas.sku_code IN (
            'sponsored_boost_quarterly_30km',
            'sponsored_boost_annual_30km'
          ) THEN 2
          ELSE 1
        END DESC,
        vas.radius_km DESC,
        vas.expires_at DESC
    ) AS rn
  FROM public.vendor_ad_subscriptions vas
  WHERE vas.cancelled_at IS NULL
    AND vas.expires_at > NOW()
)
SELECT
  vendor_profile_id,
  ad_subscription_id,
  sku_code,
  tier,
  radius_km,
  started_at,
  expires_at
FROM ranked
WHERE rn = 1;

-- ----------------------------------------------------------------------------
-- RLS — vendor reads own; admin (service-role) writes.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_ad_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_ad_subscriptions_self_read ON public.vendor_ad_subscriptions;
CREATE POLICY vendor_ad_subscriptions_self_read
  ON public.vendor_ad_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_ad_subscriptions.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
    OR public.is_admin()
  );

-- INSERT/UPDATE/DELETE intentionally not policied for users — subscription
-- activation is a privileged admin/cron concern (purchase fulfillment,
-- refund processing, expiration sweeps). Service-role only.

COMMIT;
