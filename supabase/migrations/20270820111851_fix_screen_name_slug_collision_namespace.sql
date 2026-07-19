-- fix screen name slug collision namespace
-- =============================================================================
-- BUGFIX for 20260714000000_v2_screen_name_reveal_mechanic.sql.
--
-- THE BUG (confirmed empirically via the creator-loop replay harness —
-- apps/web/tests/db/replay-migrations.ts + creator-loop.db.test.ts):
--
--   public.generate_screen_name_for_vendor() mints the numeric screen_name_id
--   in the (city, canonical_service) namespace:
--
--       v_id := public.next_screen_name_id(v_city, v_canonical);   -- OLD
--
--   but the UNIQUE slug (index vendor_profiles_screen_name_slug_unique on
--   LOWER(screen_name_slug)) is built from (city, DISPLAY LABEL, id):
--
--       v_slug := lower(regexp_replace(v_city||' '||v_display||'-'||v_id, ...));
--
--   The sequence namespace and the uniqueness namespace DIFFER. Two DIFFERENT
--   canonical_service keys that resolve to the SAME display label — commonly
--   two keys absent from canonical_service_schemas, both falling back to the
--   'Wedding Vendor' label — get INDEPENDENT id sequences that both start at 1.
--   In the same city they produce IDENTICAL slugs (e.g. `manila-wedding-vendor-1`),
--   so the SECOND same-city, same-label vendor's INSERT violates the unique
--   index and ABORTS THE SIGNUP TRANSACTION.
--
--   (The replay harness had a REPLAY-ONLY patch aligning the mint key to the
--   display label so a fresh replay could complete; this migration is the REAL
--   prod fix and supersedes that patch, which is removed in the same PR.)
--
-- THE FIX:
--   1. Redefine generate_screen_name_for_vendor() so the SEQUENCE NAMESPACE
--      MATCHES THE SLUG NAMESPACE: mint via next_screen_name_id(v_city,
--      v_display) — the display label the slug is actually built from — not
--      the canonical key. PLUS a bounded collision-retry loop: if the built
--      LOWER(screen_name_slug) already exists, re-mint the next id and retry
--      (cap 20, then RAISE a clear error). Everything else is preserved
--      byte-for-behavior: the persistence rule (NEVER regenerate an existing
--      screen_name), the venue exception, the city/label fallbacks, and the
--      AFTER-INSERT trigger contract.
--
--   2. COUNTER SEEDING (one-time backfill): switching the mint key to
--      (city, display) means a (city, display) pair may start at 1 while
--      old-scheme slugs already exist. The retry loop absorbs that, but we
--      also seed the counter cheaply: for every (city, display) the NEW
--      function would compute for an EXISTING vendor (same city fallback +
--      services[1] + schema label + 'Wedding Vendor' fallback), ensure the
--      backing counter row (vendor_screen_name_sequences) starts ABOVE the
--      max screen_name_id already used in that namespace.
--
--   3. PROD-SAFETY assert: confirm no existing duplicate LOWER(screen_name_slug)
--      rows remain (fail loud if the deployed data already carries a collision).
--
-- Idempotent: CREATE OR REPLACE FUNCTION · INSERT ... ON CONFLICT DO UPDATE
-- with GREATEST() (re-seeding only ever raises a counter, never lowers it) ·
-- read-only assert. Safe to re-apply.
-- =============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Redefined generator — mint in the slug's own (city, display) namespace,
--    with a bounded uniqueness-retry loop.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_screen_name_for_vendor(
  p_vendor_profile_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city         TEXT;
  v_services     TEXT[];
  v_canonical    TEXT;
  v_display      TEXT;
  v_id           INT;
  v_full         TEXT;
  v_taxonomy     TEXT;
  v_slug         TEXT;
  v_existing     TEXT;
  v_attempt      INT := 0;
  v_max_attempts CONSTANT INT := 20;
BEGIN
  -- Read vendor + check whether already generated.
  SELECT location_city, services, screen_name
    INTO v_city, v_services, v_existing
    FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_profile_id;

  -- Persistence rule: never regenerate.
  IF v_existing IS NOT NULL THEN
    RETURN;
  END IF;

  -- Venue exception: skip Ceremony + Reception venues (real name canonical).
  IF v_services && ARRAY['religious_venue', 'venue'] THEN
    RETURN;
  END IF;

  -- City fallback: vendors with empty location_city default to "Philippines".
  IF v_city IS NULL OR length(trim(v_city)) = 0 THEN
    v_city := 'Philippines';
  END IF;

  -- Pick primary canonical service · fallback to generic wedding_vendor key.
  v_canonical := COALESCE(v_services[1], 'wedding_vendor');

  -- Look up English display label from canonical_service_schemas.
  SELECT display_name_en
    INTO v_display
    FROM public.canonical_service_schemas
   WHERE canonical_service = v_canonical;

  -- Fallback if canonical_service not in taxonomy (legacy/orphan keys).
  IF v_display IS NULL THEN
    v_display := 'Wedding Vendor';
  END IF;

  -- Mint + build the slug in the SAME namespace the UNIQUE index is keyed on:
  -- (city, display label). Distinct canonical keys that share a display label
  -- (e.g. two orphan keys → 'Wedding Vendor') now share ONE id sequence, so
  -- they can never mint the same id → never build the same slug.
  --
  -- The bounded retry is belt-and-suspenders for the migration transition:
  -- a legacy slug minted under the old (city, canonical) scheme, or a vendor
  -- whose services drifted after its screen_name was generated, can leave a
  -- residual collision the seeding below doesn't cover. On a hit we simply
  -- re-mint the next id in the namespace and rebuild the slug.
  LOOP
    v_attempt := v_attempt + 1;

    v_id := public.next_screen_name_id(v_city, v_display);

    -- Construct strings (identical shape to the original function).
    v_taxonomy := v_city || ' ' || v_display;
    v_full     := v_taxonomy || ' #' || v_id::TEXT;
    v_slug     := lower(regexp_replace(v_taxonomy || '-' || v_id::TEXT, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug     := trim(both '-' from v_slug);

    -- Compare against the exact expression the unique index materializes.
    EXIT WHEN NOT EXISTS (
      SELECT 1
        FROM public.vendor_profiles
       WHERE lower(screen_name_slug) = v_slug
    );

    IF v_attempt >= v_max_attempts THEN
      RAISE EXCEPTION
        'generate_screen_name_for_vendor: could not allocate a unique screen_name_slug for vendor % after % attempts (namespace city=%, label=%, last slug=%)',
        p_vendor_profile_id, v_max_attempts, v_city, v_display, v_slug;
    END IF;
  END LOOP;

  -- Stamp onto vendor_profiles.
  UPDATE public.vendor_profiles
     SET screen_name = v_full,
         screen_name_taxonomy = v_taxonomy,
         screen_name_id = v_id,
         screen_name_slug = v_slug
   WHERE vendor_profile_id = p_vendor_profile_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Counter seeding — one-time backfill.
--
-- For every (city, display) the NEW function would derive for an EXISTING
-- vendor, raise its counter above the max screen_name_id already used in that
-- namespace. Recomputed from LIVE vendor data (location_city + services[1] +
-- schema label) so the seeded key matches the exact key the runtime will look
-- up. Vendors whose services/city drifted since generation are covered by the
-- retry loop above, not here.
--
-- GREATEST() on conflict makes this monotonic + re-runnable: it only ever
-- raises a counter, never lowers one.
-- ----------------------------------------------------------------------------

INSERT INTO public.vendor_screen_name_sequences (city, canonical_service, last_id)
SELECT
  city_key,
  display_key,
  MAX(sid) AS max_id
FROM (
  SELECT
    CASE
      WHEN vp.location_city IS NULL OR length(trim(vp.location_city)) = 0
        THEN 'Philippines'
      ELSE vp.location_city
    END AS city_key,
    COALESCE(css.display_name_en, 'Wedding Vendor') AS display_key,
    vp.screen_name_id AS sid
  FROM public.vendor_profiles vp
  LEFT JOIN public.canonical_service_schemas css
    ON css.canonical_service = COALESCE(vp.services[1], 'wedding_vendor')
  WHERE vp.screen_name_id IS NOT NULL
) t
GROUP BY city_key, display_key
ON CONFLICT (city, canonical_service) DO UPDATE
  SET last_id = GREATEST(
        public.vendor_screen_name_sequences.last_id,
        EXCLUDED.last_id
      );

-- ----------------------------------------------------------------------------
-- 3. Prod-safety assert — no existing duplicate LOWER(screen_name_slug).
--
-- The unique index normally forbids this, but a partial/legacy state could in
-- principle carry one. Fail loud if so; otherwise report the healthy count.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  v_dupes INT;
BEGIN
  SELECT COUNT(*)
    INTO v_dupes
    FROM (
      SELECT lower(screen_name_slug) AS s
        FROM public.vendor_profiles
       WHERE screen_name_slug IS NOT NULL
       GROUP BY lower(screen_name_slug)
      HAVING COUNT(*) > 1
    ) d;

  IF v_dupes > 0 THEN
    RAISE EXCEPTION
      'screen-name collision fix: found % duplicate LOWER(screen_name_slug) group(s) already in vendor_profiles — resolve before deploy',
      v_dupes;
  END IF;

  RAISE NOTICE 'screen-name collision fix: 0 duplicate screen_name_slug groups; namespace realigned to (city, display).';
END$$;

COMMIT;
