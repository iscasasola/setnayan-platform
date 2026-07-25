-- vendor_reach_rings
-- ============================================================================
-- TWO-RING REACH — the vendor-set Ring 1 ("free travel") + Ring 2 ("willing to
-- travel") radii. Owner-locked model
-- `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 6:
--
--   • Ring 1 "free travel"        → served + discoverable, and the vendor's
--                                   proposal TRANSPORTATION LINE IS LOCKED TO ₱0
--                                   (field disabled). Couple sees
--                                   "Free Transportation."
--   • Ring 2 "willing to travel"  → discoverable; couple sees "travel fee may
--                                   apply"; transportation line stays editable.
--   • Beyond Ring 2               → vendor not shown to that couple.
--   • THE EVENT VENUE decides the ring (events.venue_latitude/longitude vs
--     vendor_profiles.hq_latitude/longitude — both already exist, added by
--     20260525010000_vendor_hq_geocode_and_event_venue_anchor.sql; this
--     migration adds NO new geo columns, it reuses those).
--   • The Ring-2 outer bound is TIER-CAPPED: Free/Solo ~30 km · Pro ~60 km ·
--     Enterprise 100 km.
--
-- ── WHY THESE ARE *NOT* ADDED TO guard_vendor_profiles_entitlement ──────────
-- That guard (20270920020000 + 20271002456914) exists because RLS on
-- vendor_profiles is ROW-level and `vendor_profiles_owner` is FOR ALL with no
-- column scoping — so any PAID ENTITLEMENT column must be trigger-protected or
-- a vendor can self-grant it through PostgREST.
--
-- These two columns are the OPPOSITE kind of column: they are a vendor
-- PREFERENCE the vendor is *supposed* to set from their own dashboard, the same
-- way they set hq_address. Nothing is granted by writing them. The paid
-- entitlement here is the TIER CAP, and that cap is applied at READ time by
-- `resolveRingRadii()` in apps/web/lib/vendor-reach-rings.ts — a Solo vendor who
-- PATCHes reach_ring2_km = 999 still resolves to 30 km, because no consumer ever
-- reads the raw column. Clamp-at-read, not trust-the-column, is the boundary.
--
-- The CHECK below is therefore a sanity bound (0–100 km, the widest any tier can
-- ever reach), not a security control.
--
-- ── FAIL-SAFE DEFAULTS ─────────────────────────────────────────────────────
-- Both columns are NULLABLE with NO default, and NULL means "never set":
--   • reach_ring1_km NULL → resolver uses 0 km → NO free-travel ring → NOTHING
--     is ever forced to ₱0. A vendor must opt IN to free transport; they are
--     never opted in for them. This is the direction that matters — Ring 1 is
--     the ring that confiscates a travel fee.
--   • reach_ring2_km NULL → resolver uses the vendor's tier cap, i.e. the widest
--     reach their plan allows, so discoverability never narrows on deploy.
--
-- Additive + nullable + idempotent. Reading these columns is flag-dark behind
-- NEXT_PUBLIC_VENDOR_REACH_RINGS_V1, so a deploy/schema skew can't blank a
-- vendor_profiles read (PostgREST answers an unknown column with 42703 and nulls
-- the WHOLE row).
-- ============================================================================

BEGIN;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS reach_ring1_km INTEGER
    CHECK (reach_ring1_km IS NULL OR (reach_ring1_km BETWEEN 0 AND 100));

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS reach_ring2_km INTEGER
    CHECK (reach_ring2_km IS NULL OR (reach_ring2_km BETWEEN 0 AND 100));

COMMENT ON COLUMN public.vendor_profiles.reach_ring1_km IS
  'Ring 1 "free travel" radius in km from hq_latitude/hq_longitude (owner-locked '
  'model 2026-07-25 section 6). An event venue inside this ring FORCES the '
  'vendor''s proposal transportation line to zero with the field disabled; the '
  'couple sees "Free Transportation." NULL = never set = 0 km = no free-travel '
  'ring (a vendor opts IN to free transport — the default never confiscates a '
  'travel fee). Clamped at read to <= the effective Ring 2 by '
  'lib/vendor-reach-rings.ts.';

COMMENT ON COLUMN public.vendor_profiles.reach_ring2_km IS
  'Ring 2 "willing to travel" OUTER radius in km from hq_latitude/hq_longitude. '
  'Inside it (and outside Ring 1) the vendor is discoverable and the couple sees '
  '"travel fee may apply"; BEYOND it the vendor is not shown to that couple. '
  'NULL = never set = the vendor''s tier cap. TIER-CAPPED at READ time — Free/Solo '
  '30 km, Pro 60 km, Enterprise/Custom 100 km (RING2_CAP_KM in '
  'lib/vendor-reach-rings.ts). This column is a vendor PREFERENCE, not an '
  'entitlement: it is deliberately NOT in guard_vendor_profiles_entitlement '
  'because the cap is enforced by the read-side clamp, so a self-PATCHed 999 '
  'still resolves to the tier cap.';

-- Partial index: only rows that have actually opted into a custom reach. Keeps
-- the index tiny while the flag is dark (zero rows) and supports the eventual
-- "which vendors reach this venue" pre-filter without a full scan.
CREATE INDEX IF NOT EXISTS vendor_profiles_reach_rings_idx
  ON public.vendor_profiles (reach_ring2_km, reach_ring1_km)
  WHERE reach_ring2_km IS NOT NULL OR reach_ring1_km IS NOT NULL;

COMMIT;
