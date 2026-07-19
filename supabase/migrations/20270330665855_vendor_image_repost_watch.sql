-- vendor_image_repost_watch
-- On-platform reverse-image repost detection via perceptual hashing (pHash).
--
-- WHAT THIS IS: a detect-and-flag-for-admin-review-ONLY integrity signal. A
-- 64-bit DCT pHash is computed server-side (post-upload, in a Next `after()`
-- task) from a vendor's OWN marketing imagery — the two portfolio-grade R2
-- surfaces (vendor_services.primary_photo_r2_key + vendor_profiles.portfolio_r2_keys).
-- When a NEW upload perceptually matches (Hamming distance <= an admin-managed
-- threshold) an OLDER image owned by a DIFFERENT, non-demo vendor, an open row
-- lands in vendor_image_flags for a moderator at /admin/repost-watch. It NEVER
-- auto-blocks, auto-takes-down, or auto-deletes — the founder-only marketplace
-- pilot (~1 real vendor + a seeded demo set) makes auto-punishment unsafe.
--
-- RA 10173 (Data Privacy Act) posture: a pHash is a non-reversible, lossy 64-bit
-- fingerprint of PIXEL STRUCTURE — you cannot reconstruct a face or a person from
-- 8 bytes. It is derived from vendor-supplied marketing images the vendor chose
-- to publish, NOT from guest/event/face content (those live in Papic's
-- per-event-scoped face vectors, untouched here). Admin-read-only RLS mirrors the
-- existing user_reports queue.
--
-- KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. hamming_distance(a BIGINT, b BIGINT) — popcount of the 64-bit XOR.
--
--    The match is "how many of the 64 bits differ between two pHashes". We store
--    pHashes as BIGINT (signed 64-bit). To count differing bits WITHOUT relying
--    on PG14's bit_count() (the prod Postgres version is unverified in-repo —
--    no supabase/config.toml — and there is zero bit_count precedent in the 575
--    existing migrations), we:
--
--      1. cast each bigint to bit(64)            -- documented, version-agnostic
--      2. XOR the two bit strings with `#`       -- `#` IS defined for bit types
--                                                   (NOT for bytea — that was the
--                                                   bug the review caught)
--      3. count the '1' chars in the bit-string's text form
--         length(replace(<bits>::text, '0', '')).
--
--    A hand-rolled INTEGER Brian-Kernighan loop was rejected on purpose: it
--    needs `x & (x - 1)`, and `x - 1` OVERFLOWS for the most-negative bigint
--    (INT64_MIN), which a sign-bit-set pHash can legitimately be. The bit-string
--    form has no arithmetic and no overflow surface.
--
--    IMMUTABLE + STRICT so the planner can fold it into index-free scans and so a
--    NULL input short-circuits to NULL (never a spurious 0-distance match).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.hamming_distance(a BIGINT, b BIGINT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT length(
    replace((a::bit(64) # b::bit(64))::text, '0', '')
  )::int;
$$;

COMMENT ON FUNCTION public.hamming_distance(BIGINT, BIGINT) IS
  'Population count of the 64-bit XOR of two perceptual hashes (number of '
  'differing bits, 0..64). Version-agnostic: bit(64) XOR + count of set bits, '
  'NO PG14 bit_count(), NO integer arithmetic (overflow-safe for INT64_MIN). '
  'Used by the reverse-image repost-watch match.';

-- ----------------------------------------------------------------------------
-- 1. vendor_image_hashes — one row per (vendor, r2_ref) we have hashed.
--
--    The natural idempotency key is (vendor_profile_id, r2_ref): re-hashing the
--    same ref is a no-op upsert. is_demo is DENORMALIZED from vendor_profiles at
--    hash time so the match query can cheaply exclude demo↔* collisions (demo
--    vendors share seeded/stock portfolio imagery — collisions there are
--    expected and meaningless).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_image_hashes (
  id                 BIGSERIAL PRIMARY KEY,
  vendor_profile_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  surface            TEXT NOT NULL CHECK (surface IN ('service_primary', 'portfolio')),
  -- The exact stored TEXT value of the source column (an `r2://bucket/key` ref,
  -- or a legacy http(s) URL). Natural idempotency key.
  r2_ref             TEXT NOT NULL,
  -- 64-bit DCT pHash as a signed BIGINT. Matched via hamming_distance() above.
  phash              BIGINT NOT NULL,
  -- Denormalized from vendor_profiles.is_demo at hash time (see match query).
  is_demo            BOOLEAN NOT NULL DEFAULT FALSE,
  -- Provenance for "first seen wins" ownership reasoning in the admin UI.
  hashed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vendor_profile_id, r2_ref)
);

CREATE INDEX IF NOT EXISTS vendor_image_hashes_vendor_idx
  ON public.vendor_image_hashes(vendor_profile_id);
-- Partial index keeps the real (non-demo) candidate set tiny for the match scan.
CREATE INDEX IF NOT EXISTS vendor_image_hashes_real_idx
  ON public.vendor_image_hashes(is_demo) WHERE is_demo = FALSE;

ALTER TABLE public.vendor_image_hashes ENABLE ROW LEVEL SECURITY;

-- Admins read everything (the queue + the match query run admin-side).
DROP POLICY IF EXISTS vendor_image_hashes_admin_read ON public.vendor_image_hashes;
CREATE POLICY vendor_image_hashes_admin_read ON public.vendor_image_hashes
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No vendor/self read policy: hashes are an internal integrity signal, never
-- vendor-facing. No INSERT/UPDATE policy for `authenticated` either — RLS denies
-- by default. HONEST NOTE: that deny-by-default protects VENDORS from touching
-- the table, but it is NOT the write guard for the feature itself. Every write
-- here is performed with the service-role admin client (createAdminClient),
-- which BYPASSES RLS. The real guard is application-level: ONLY the post-save
-- `after()` task and the admin rescan/resolve actions ever construct that client.

COMMENT ON TABLE public.vendor_image_hashes IS
  'Perceptual hashes (64-bit DCT pHash, stored BIGINT) of vendor portfolio + '
  'service cover images, computed server-side after upload. Internal integrity '
  'signal for cross-vendor repost detection — admin-read-only RLS; all writes go '
  'via the service-role admin client. is_demo denormalized so demo collisions are '
  'excluded from flags. RA 10173: non-reversible fingerprint of vendor marketing '
  'imagery, not guest/face/event data.';

-- ----------------------------------------------------------------------------
-- 2. vendor_image_flags — the admin review queue.
--
--    One row = a newly-uploaded vendor image that perceptually matches an OLDER
--    image owned by a DIFFERENT, non-demo vendor. flagged_* is the likely
--    reposter (the new upload); source_* is the likely victim (first seen).
--    public_id uses type letter 'N' (repost-watch) — 'W' is taken by
--    ugc_moderation + vendor_spotlight_awards.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_image_flags (
  id                 BIGSERIAL PRIMARY KEY,
  public_id          TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('N'),
  -- The vendor whose NEW upload matched an older image (the likely reposter).
  flagged_vendor_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  flagged_r2_ref     TEXT NOT NULL,
  flagged_surface    TEXT NOT NULL CHECK (flagged_surface IN ('service_primary', 'portfolio')),
  -- The vendor who owned a perceptually-identical image FIRST (the likely victim).
  source_vendor_id   UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  source_r2_ref      TEXT NOT NULL,
  source_surface     TEXT NOT NULL CHECK (source_surface IN ('service_primary', 'portfolio')),
  hamming_distance   SMALLINT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'dismissed', 'confirmed_theft', 'escalated')),
  resolution_notes   TEXT,
  reviewed_by        UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Dedup: never two rows for the same suspected-image / source-image pair.
  UNIQUE (flagged_r2_ref, source_r2_ref)
);

CREATE INDEX IF NOT EXISTS vendor_image_flags_status_idx
  ON public.vendor_image_flags(status);
CREATE INDEX IF NOT EXISTS vendor_image_flags_flagged_vendor_idx
  ON public.vendor_image_flags(flagged_vendor_id);

ALTER TABLE public.vendor_image_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_image_flags_admin_read ON public.vendor_image_flags;
CREATE POLICY vendor_image_flags_admin_read ON public.vendor_image_flags
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS vendor_image_flags_admin_update ON public.vendor_image_flags;
CREATE POLICY vendor_image_flags_admin_update ON public.vendor_image_flags
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- INSERT is done by the service-role admin client only (the `after()` task + the
-- admin rescan action); RLS grants no INSERT to `authenticated`. Same honest
-- caveat as vendor_image_hashes: the deny-by-default blocks vendors, but the
-- actual write path bypasses RLS — the guard is "only trusted server code builds
-- the admin client".

COMMENT ON TABLE public.vendor_image_flags IS
  'Cross-vendor repost-detection review queue. A row = a newly-uploaded vendor '
  'image that perceptually matches (Hamming <= admin threshold) an OLDER image '
  'owned by a DIFFERENT, non-demo vendor. Flag-and-review only — never '
  'auto-blocks/takes-down/deletes. Resolved by an admin at /admin/repost-watch.';

-- ----------------------------------------------------------------------------
-- 3. Admin-managed match threshold (prices/thresholds are admin-managed, NEVER
--    hardcoded). Added as a typed column on the existing admin-editable
--    platform_settings singleton (id = 1), edited via /admin/settings. Default
--    10 bits is the industry-standard "near-duplicate" cutoff (<=6 is "almost
--    certainly the same image, lightly re-encoded"). The lib falls back to 10
--    only when the row/column can't be read (e.g. missing service-role in CI).
-- ----------------------------------------------------------------------------

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS repost_watch_hamming_threshold INTEGER NOT NULL DEFAULT 10;

COMMENT ON COLUMN public.platform_settings.repost_watch_hamming_threshold IS
  'Max Hamming distance (0..64) at which two vendor-image pHashes are treated as '
  'a repost match and flagged for admin review. Admin-managed; default 10.';

COMMIT;
