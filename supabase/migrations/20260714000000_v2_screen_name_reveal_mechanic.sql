-- =============================================================================
-- 20260714000000_v2_screen_name_reveal_mechanic.sql
-- v2.1 BRIEF AMENDMENT #2 REFINEMENT · screen-name reveal mechanic for
-- Free + Verified vendors with venue exception.
--
-- WHY: per CLAUDE.md 2026-05-30 row "V2.1 BRIEF AMENDMENT #2 REFINEMENT ·
-- venue exception locked + engineering kickoff for the screen-name reveal
-- mechanic from line 544 row":
--
--   - Owner directive 2026-05-30: "Manila Wedding Photographer #4218 return
--     these. this will be for vendors with free and verified accounts. that
--     will be their names. these 'Screen Names' will persist. now when a
--     customer inquires, and the vendor accepts the inquiry and they reply,
--     we can now show the actual name of the vendor. because it is now
--     unlocked. the only vendors that will have no screen names are the
--     Ceremony and Reception Venues. We will let them keep their names."
--
--   - 3 owner-confirmed locks via AskUserQuestion:
--       (a) Pro + Enterprise = real name from day 1 (paid tier visibility
--           privilege per v2.1 § 3 vendor matrix)
--       (b) Unlock = platform-wide once accepted anywhere (first vendor
--           reply on ANY thread permanently stamps real_name_unlocked_at ·
--           vendor screen name dies forever everywhere from then on)
--       (c) Ship pre-pilot best effort (2 days to pilot 2026-06-01)
--
-- What this migration ships:
--
--   1. vendor_tier_state ENUM (free/verified/pro/enterprise)
--   2. 6 new columns on vendor_profiles (tier_state + 5 screen_name fields +
--      real_name_unlocked_at timestamp)
--   3. Unique index on screen_name_slug (case-insensitive)
--   4. vendor_screen_name_sequences sequence table (per (city, canonical_service))
--   5. next_screen_name_id(city, canonical_service) function
--   6. generate_screen_name_for_vendor(vendor_profile_id) function
--   7. AFTER INSERT trigger on vendor_profiles to auto-generate screen_name
--   8. AFTER INSERT trigger on chat_messages to stamp real_name_unlocked_at
--      on first vendor reply
--   9. Backfill: flip verification_state='verified' to tier_state='verified'
--      + generate screen_names for existing Free + Verified non-venue vendors
--
-- Display-side logic (NOT in this migration · ships in PR 2):
--   apps/web/lib/vendor-display.ts → displayVendorName(vendor) returns
--   business_name when:
--     (a) vendor.services && ARRAY['religious_venue', 'venue']  (venue exception)
--     (b) vendor.tier_state IN ('pro', 'enterprise')             (paid tier)
--     (c) vendor.real_name_unlocked_at IS NOT NULL               (post-reply unlock)
--   Otherwise returns vendor.screen_name.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS · ADD COLUMN IF NOT EXISTS ·
-- CREATE OR REPLACE FUNCTION · DROP TRIGGER IF EXISTS + CREATE TRIGGER ·
-- backfill guarded by NULL checks. Safe to re-apply.
--
-- Pilot 2026-06-01 timing: 2 days from migration apply. Pilot vendors
-- signing up after this migration land at tier_state='free' + auto-gen
-- screen_name. Pilot couples see anonymized vendor cards in marketplace +
-- microsite until vendor sends first chat reply.
-- =============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_tier_state ENUM
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'vendor_tier_state'
  ) THEN
    CREATE TYPE public.vendor_tier_state AS ENUM (
      'free',
      'verified',
      'pro',
      'enterprise'
    );
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- 2. vendor_profiles new columns
--
-- tier_state: canonical 4-tier model from v2.1 brief § 3 vendor matrix.
--             default 'free' for new signups · backfilled below from
--             verification_state. Pro + Enterprise stay manually-flippable
--             by admin for pilot (V1.x auto-derives from active subscription
--             orders).
-- screen_name: full anonymized display name. Format "Manila Wedding
--              Photographer #4218". Persists once generated · never
--              regenerated even if vendor changes location_city or services.
-- screen_name_taxonomy: just the taxonomy portion "Manila Wedding
--                       Photographer" (without #ID suffix).
-- screen_name_id: monotonic numeric ID within (city, canonical_service)
--                 namespace.
-- screen_name_slug: kebab-case slug for /v/[slug] microsite URL ·
--                   "manila-wedding-photographer-4218".
-- real_name_unlocked_at: NULL until first vendor chat reply ·
--                        once stamped, never cleared · helper logic
--                        flips to real-name display globally.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS tier_state public.vendor_tier_state NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS screen_name TEXT,
  ADD COLUMN IF NOT EXISTS screen_name_taxonomy TEXT,
  ADD COLUMN IF NOT EXISTS screen_name_id INT,
  ADD COLUMN IF NOT EXISTS screen_name_slug TEXT,
  ADD COLUMN IF NOT EXISTS real_name_unlocked_at TIMESTAMPTZ;

-- Case-insensitive uniqueness on screen_name_slug, only when set.
-- Pattern matches existing business_slug index for symmetry.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_profiles_screen_name_slug_unique
  ON public.vendor_profiles (LOWER(screen_name_slug))
  WHERE screen_name_slug IS NOT NULL;

-- Tier filter index for marketplace queries that gate on tier_state.
CREATE INDEX IF NOT EXISTS vendor_profiles_tier_state_idx
  ON public.vendor_profiles(tier_state);

-- ----------------------------------------------------------------------------
-- 3. vendor_screen_name_sequences
--
-- One row per (city, canonical_service) namespace. INSERT ON CONFLICT
-- pattern ensures concurrent-safe increment.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_screen_name_sequences (
  city               TEXT NOT NULL,
  canonical_service  TEXT NOT NULL,
  last_id            INT NOT NULL DEFAULT 0,
  PRIMARY KEY (city, canonical_service)
);

-- Admin-readable for diagnostics. Not user-facing.
ALTER TABLE public.vendor_screen_name_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_screen_name_sequences_admin_read
  ON public.vendor_screen_name_sequences;
CREATE POLICY vendor_screen_name_sequences_admin_read
  ON public.vendor_screen_name_sequences FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
       WHERE user_id = auth.uid()
         AND account_type = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 4. next_screen_name_id(city, canonical_service)
--
-- Concurrent-safe via INSERT ON CONFLICT DO UPDATE · returns next sequential
-- ID for the given namespace. First call returns 1.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.next_screen_name_id(
  p_city              TEXT,
  p_canonical_service TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id INT;
BEGIN
  INSERT INTO public.vendor_screen_name_sequences (city, canonical_service, last_id)
  VALUES (p_city, p_canonical_service, 1)
  ON CONFLICT (city, canonical_service) DO UPDATE
    SET last_id = vendor_screen_name_sequences.last_id + 1
  RETURNING last_id INTO v_id;
  RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. generate_screen_name_for_vendor(vendor_profile_id)
--
-- Reads vendor row · skips if already generated (persistence rule) · skips
-- if venue-exception (services overlap with religious_venue + venue) ·
-- looks up canonical service display label · mints next ID · constructs
-- "{City} {Display Label} #{ID}" + slug · stamps onto vendor_profiles.
--
-- NULL-safe city + canonical fallbacks ensure every Free/Verified non-venue
-- vendor gets a screen_name even with sparse profile data.
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
  v_city       TEXT;
  v_services   TEXT[];
  v_canonical  TEXT;
  v_display    TEXT;
  v_id         INT;
  v_full       TEXT;
  v_taxonomy   TEXT;
  v_slug       TEXT;
  v_existing   TEXT;
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

  -- City fallback: vendors with empty location_city default to "Philippines"
  -- so the screen_name still reads sensibly. The (city, canonical_service)
  -- namespace bucket gets shared across all city-less vendors.
  IF v_city IS NULL OR length(trim(v_city)) = 0 THEN
    v_city := 'Philippines';
  END IF;

  -- Pick primary canonical service · fallback to generic wedding_vendor
  -- key if vendor's services array is empty (rare · means vendor signed
  -- up without picking a category yet).
  v_canonical := COALESCE(v_services[1], 'wedding_vendor');

  -- Look up English display label from canonical_service_schemas.
  -- Schema host: iteration 0044 per_category_schemas_base migration.
  SELECT display_name_en
    INTO v_display
    FROM public.canonical_service_schemas
   WHERE canonical_service = v_canonical;

  -- Fallback if canonical_service not in taxonomy (handles legacy/orphan
  -- service keys gracefully).
  IF v_display IS NULL THEN
    v_display := 'Wedding Vendor';
  END IF;

  -- Mint next ID in namespace.
  v_id := public.next_screen_name_id(v_city, v_canonical);

  -- Construct strings.
  v_taxonomy := v_city || ' ' || v_display;
  v_full := v_taxonomy || ' #' || v_id::TEXT;

  -- Slug: kebab-case of full screen_name · safe for /v/[slug] URLs.
  v_slug := lower(regexp_replace(v_taxonomy || '-' || v_id::TEXT, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);

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
-- 6. AFTER INSERT trigger on vendor_profiles
--
-- Fires after every new vendor row · generate function handles all the
-- skip/fallback logic internally · trigger just delegates.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_vendor_profiles_generate_screen_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.generate_screen_name_for_vendor(NEW.vendor_profile_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_profiles_generate_screen_name ON public.vendor_profiles;
CREATE TRIGGER vendor_profiles_generate_screen_name
  AFTER INSERT ON public.vendor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_vendor_profiles_generate_screen_name();

-- ----------------------------------------------------------------------------
-- 7. AFTER INSERT trigger on chat_messages → unlock real name
--
-- Fires after every new chat_message · if sender_role = 'vendor' AND
-- vendor's real_name_unlocked_at IS NULL · stamp NOW() onto vendor_profiles.
-- Venue + Pro/Enterprise vendors get their real_name_unlocked_at stamped
-- too for audit consistency (helper function short-circuits on services
-- overlap + tier_state before consulting real_name_unlocked_at · trigger
-- doesn't need to know about exceptions). Idempotent: only stamps if NULL.
--
-- Cross-references:
--   - chat_messages.vendor_profile_id → direct FK lookup
--   - chat_messages.sender_role enum: 'couple' | 'vendor' | 'coordinator'
--   - chat_sender_role declared in iteration 0019 communications migration
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_chat_messages_unlock_vendor_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_role = 'vendor' THEN
    UPDATE public.vendor_profiles
       SET real_name_unlocked_at = NOW()
     WHERE vendor_profile_id = NEW.vendor_profile_id
       AND real_name_unlocked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_unlock_vendor_name ON public.chat_messages;
CREATE TRIGGER chat_messages_unlock_vendor_name
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_chat_messages_unlock_vendor_name();

-- ----------------------------------------------------------------------------
-- 8. Backfill — tier_state from verification_state
--
-- Any existing vendor whose verification_state = 'verified' (handed-approved
-- by admin earlier this week per the seed migrations + admin verify flow)
-- gets lifted to tier_state = 'verified'. Free + others stay at default.
-- Pro + Enterprise vendors don't exist yet (no active subscription orders
-- per V2 catalog seed lineage) · admin manually flips post-deploy as needed.
-- ----------------------------------------------------------------------------

UPDATE public.vendor_profiles
   SET tier_state = 'verified'
 WHERE verification_state = 'verified'
   AND tier_state = 'free';

-- ----------------------------------------------------------------------------
-- 9. Backfill — generate screen_names for existing Free + Verified non-venue
--    vendors.
--
-- Iterates every vendor that doesn't yet have a screen_name AND isn't in
-- the venue exception. Trigger handles individual rows · this loop just
-- iterates.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  v_vendor_profile_id UUID;
BEGIN
  FOR v_vendor_profile_id IN
    SELECT vendor_profile_id
      FROM public.vendor_profiles
     WHERE screen_name IS NULL
       AND NOT (services && ARRAY['religious_venue', 'venue'])
  LOOP
    PERFORM public.generate_screen_name_for_vendor(v_vendor_profile_id);
  END LOOP;
END$$;

COMMIT;
