-- ════════════════════════════════════════════════════════════════════════════
-- INNER / OUTER SERVICE RADIUS — the vendor DECLARES their reach, in two rings.
--
-- Owner-locked 2026-07-27: **"they have inner radius. this radius must comply
-- to give free transportation fee if within this radius. outer radius is the
-- overall range."** and **"Per vendor. Vendor has their HQ and x km from their
-- HQ means free transportation fee."**
--
-- Spec: Explore_Replan_BUILD_SPEC_2026-07-27.md §17 · DECISION_LOG 2026-07-27.
--
-- ── WHAT EXISTED BEFORE THIS COLUMN PAIR ────────────────────────────────────
-- Reach was ONE number and PURELY TIER-DERIVED (`tierCaps().serviceRadiusKm`:
-- free 0 · verified/solo 20 · pro 50 · enterprise/custom 100). No vendor-
-- declared radius column existed anywhere in the schema. Transport was
-- expressed by DISTANCE-BLIND flags — `vendor_services.transport_included` /
-- `transport_flat_fee_php`, `vendor_package_items.transport_mode` /
-- `transport_flat_centavos` — so a vendor could only say "transport included
-- ALWAYS" or "flat fee ALWAYS". They could NOT say *"free within 15 km,
-- chargeable beyond"*, which is how PH suppliers actually price.
--
-- ── WHAT THE TWO RINGS MEAN ─────────────────────────────────────────────────
--   inner_radius_km — inside it, the vendor travels for FREE. The couple owes
--                     no transportation fee. This is a PRICE PROMISE, not a
--                     coverage claim.
--   outer_radius_km — the furthest they will travel at all. Between inner and
--                     outer they still come, but a travel fee applies. Beyond
--                     outer they are out of range.
-- Both measured straight-line (haversine) from the vendor's HQ pin
-- (`hq_latitude` / `hq_longitude`) to the event's venue — the same distance the
-- couple's bench already computes per candidate. No new geo math.
--
-- ── WHY NULLABLE, AND WHY THAT IS THE POINT ─────────────────────────────────
-- NULL = "not declared yet". A blank is NEVER a penalty and NEVER a claim: the
-- couple-facing badge falls back EXACTLY to today's tier-derived reach read
-- when either ring is NULL. Nobody is worse off for not having filled this in,
-- which is the only way a voluntary declaration field ever gets adopted.
--
-- ── THE TIER CAP IS *NOT* A DB CHECK, DELIBERATELY ──────────────────────────
-- `outer_radius_km <= tierCaps(tier).serviceRadiusKm` is enforced in the app
-- (write-time refusal) AND re-derived at READ time by
-- `effectiveOuterRadiusKm(declared, tier)`. It is NOT a CHECK constraint,
-- because a CHECK would have to read `tier_state` from the same row and would
-- then FIRE ON DOWNGRADE — a vendor whose Pro subscription lapses would make
-- their own row un-updatable, and any unrelated write to that row (a logo
-- change, a name reveal) would start throwing. The clamp belongs at read time
-- so a lapsed subscription silently stops buying reach instead of bricking the
-- profile. Stored 50 + tier verified reads as 20, forever, with no backfill job.
--
-- What IS enforced here is the pair's internal consistency (inner <= outer) and
-- non-negativity — invariants that hold regardless of tier, so they can never
-- be tripped by a subscription change.
--
-- ⚠ 0 IS ALLOWED, and means something: inner_radius_km = 0 is "we charge travel
-- from the front door" — a real PH pricing stance, and distinct from NULL
-- ("haven't said"). outer_radius_km = 0 would mean "we don't travel at all",
-- which is also a legitimate, if unusual, declaration.
--
-- ── SCOPE: PER VENDOR, NOT PER SERVICE ──────────────────────────────────────
-- Owner: *"Per vendor. Vendor has their HQ..."* — the rings hang off the HQ, so
-- they live on `vendor_profiles`, not `vendor_services`. §17.3 left this as an
-- open call; the owner settled it 2026-07-27.
--
-- ── ACL ─────────────────────────────────────────────────────────────────────
-- No new OBJECT is created (no table, no view, no function), so the default-ACL
-- rule has nothing to revoke here: ALTER TABLE ... ADD COLUMN inherits
-- `vendor_profiles`' existing grants and its existing RLS policies unchanged.
-- The vendor writes these through the write policy the profile already carries;
-- couples read them through the same admin-client enrichment path that already
-- reads `tier_state`.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS inner_radius_km INTEGER;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS outer_radius_km INTEGER;

-- Non-negative. A negative radius is not a smaller circle, it is a typo.
ALTER TABLE public.vendor_profiles
  DROP CONSTRAINT IF EXISTS vendor_profiles_inner_radius_km_nonneg;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_inner_radius_km_nonneg
  CHECK (inner_radius_km IS NULL OR inner_radius_km >= 0);

ALTER TABLE public.vendor_profiles
  DROP CONSTRAINT IF EXISTS vendor_profiles_outer_radius_km_nonneg;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_outer_radius_km_nonneg
  CHECK (outer_radius_km IS NULL OR outer_radius_km >= 0);

-- The pair's ordering invariant. Written NULL-tolerantly on BOTH sides so a
-- vendor may declare one ring without the other (the couple-facing badge simply
-- stays on its tier-derived fallback until both exist).
ALTER TABLE public.vendor_profiles
  DROP CONSTRAINT IF EXISTS vendor_profiles_inner_within_outer_radius;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_inner_within_outer_radius
  CHECK (
    inner_radius_km IS NULL
    OR outer_radius_km IS NULL
    OR inner_radius_km <= outer_radius_km
  );

COMMENT ON COLUMN public.vendor_profiles.inner_radius_km IS
  'FREE-TRANSPORT RING, in whole km, straight-line from the vendor''s HQ pin '
  '(hq_latitude/hq_longitude). An event venue INSIDE this ring pays NO '
  'transportation fee - it is the vendor''s own price promise, not a coverage '
  'claim. NULL = not declared (the couple-facing badge falls back to the '
  'tier-derived reach read; a blank is never a penalty and never a claim). '
  '0 is meaningful and distinct from NULL: "we charge travel from the front '
  'door". Must be <= outer_radius_km when both are set. Owner-locked '
  '2026-07-27: "x km from their HQ means free transportation fee." '
  'Explore_Replan_BUILD_SPEC_2026-07-27 sec 17.';

COMMENT ON COLUMN public.vendor_profiles.outer_radius_km IS
  'OVERALL RANGE, in whole km, straight-line from the vendor''s HQ pin. Between '
  'inner_radius_km and this the vendor still travels but a TRAVEL FEE applies; '
  'beyond this they are out of range. NULL = not declared (tier-derived '
  'fallback). CAPPED BY THE TIER at write time AND re-clamped at read time by '
  'effectiveOuterRadiusKm(declared, tier) - deliberately NOT a CHECK '
  'constraint, because a tier-reading CHECK would fire on DOWNGRADE and brick '
  'every write to a lapsed vendor''s row. A vendor who declared 50 km on Pro '
  'and drops to Verified reads as 20 km with no backfill. Owner-locked '
  '2026-07-27: "outer radius is the overall range." '
  'Explore_Replan_BUILD_SPEC_2026-07-27 sec 17.';

-- ── Post-conditions. Prove the constraints are OBJECTS that actually bite,
--    not just DDL that reported success. (schema_migrations can lie: a
--    migration can record as applied while its columns never landed.)
DO $$
DECLARE
  probe_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'vendor_profiles'
       AND column_name = 'inner_radius_km'
  ) THEN
    RAISE EXCEPTION 'inner_radius_km did not land on vendor_profiles';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'vendor_profiles'
       AND column_name = 'outer_radius_km'
  ) THEN
    RAISE EXCEPTION 'outer_radius_km did not land on vendor_profiles';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.vendor_profiles'::regclass
       AND conname = 'vendor_profiles_inner_within_outer_radius'
  ) THEN
    RAISE EXCEPTION 'the inner <= outer CHECK is not an object on vendor_profiles';
  END IF;

  SELECT vendor_profile_id INTO probe_id FROM public.vendor_profiles LIMIT 1;
  IF probe_id IS NULL THEN
    RAISE NOTICE 'no vendor_profiles rows to probe the CHECKs against - constraint existence verified above';
    RETURN;
  END IF;

  -- inner > outer must be impossible.
  BEGIN
    UPDATE public.vendor_profiles
       SET inner_radius_km = 30, outer_radius_km = 10
     WHERE vendor_profile_id = probe_id;
    RAISE EXCEPTION 'inner > outer was accepted - the ordering CHECK is not biting';
  EXCEPTION WHEN check_violation THEN
    NULL; -- expected
  END;

  -- A negative radius must be impossible.
  BEGIN
    UPDATE public.vendor_profiles
       SET outer_radius_km = -1
     WHERE vendor_profile_id = probe_id;
    RAISE EXCEPTION 'a negative radius was accepted - the non-negative CHECK is not biting';
  EXCEPTION WHEN check_violation THEN
    NULL; -- expected
  END;

  -- One ring alone must be ALLOWED (the ordering CHECK is NULL-tolerant), then
  -- put the row straight back so this migration leaves every row untouched.
  BEGIN
    UPDATE public.vendor_profiles
       SET outer_radius_km = 20
     WHERE vendor_profile_id = probe_id;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'a lone outer radius was rejected - the ordering CHECK is not NULL-tolerant';
  END;
  UPDATE public.vendor_profiles
     SET inner_radius_km = NULL, outer_radius_km = NULL
   WHERE vendor_profile_id = probe_id;
END $$;
