-- ============================================================================
-- 20270928100000_event_vendors_market_median_exclusion.sql
--
-- VERIFIED-MEDIAN PRICING — the excludable-booking mechanism (dark core).
--
-- A vendor's verified market price is the MEDIAN of their DECLARED prices from
-- LOCKED bookings — couple-confirmed `event_vendors` rows keyed to the
-- marketplace vendor via `linked_vendor_profile_id`, status ≥ 'contracted'
-- (CONFIRMED_VENDOR_STATUSES), with a positive `total_cost_php`.
--
-- Some locks are NOT representative of the market (a comp, a barter, a ₱0/promo
-- deal, or a family-rate booking) and would skew the median. `total_cost_php`
-- <= 0 is already dropped by the reader, but a non-zero-but-non-market lock
-- needs an explicit way to be marked out. This adds ONE nullable-safe boolean:
--
--     event_vendors.excluded_from_market_median  BOOLEAN NOT NULL DEFAULT FALSE
--
-- The verified-median reader filters `WHERE excluded_from_market_median = FALSE`.
-- Excluded rows never count toward the min-sample floor either.
--
-- SETTER (flagged for follow-up): market integrity means the intended owner of
-- this flag is an ADMIN, not the couple — a couple should not be able to prune
-- their own locks out of a vendor's public price. No couple-facing control is
-- shipped here; the column defaults FALSE for every existing and new row, so
-- behaviour is unchanged until an admin surface (or a barter-tagging flow) sets
-- it. Existing couple RLS on event_vendors is intentionally left as-is for this
-- dark build; the admin console reads/writes via the service-role client.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS). Non-breaking: no row data is modified,
-- no policy changes, no index churn beyond one tiny partial index used by the
-- aggregate reader.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS excluded_from_market_median BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.event_vendors.excluded_from_market_median IS
  'Verified-median pricing: when TRUE this locked booking is treated as NON-representative (comp / barter / ₱0 / promo / family-rate) and is dropped from the vendor''s market-median computation — and does not count toward the min-sample floor. Default FALSE. Intended setter is an admin (market integrity); no couple-facing control ships in the dark core. Read by lib/verified-median-read.ts.';

-- Partial index: the median reader scans confirmed, linked, non-excluded rows
-- per vendor. Keeping it partial (only the rows the reader cares about) keeps it
-- small — most event_vendors rows are unlinked / exploratory.
CREATE INDEX IF NOT EXISTS event_vendors_market_median_idx
  ON public.event_vendors (linked_vendor_profile_id)
  WHERE linked_vendor_profile_id IS NOT NULL
    AND excluded_from_market_median = FALSE;

COMMIT;
