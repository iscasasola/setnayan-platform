-- ============================================================================
-- EVERY SHOP GETS AN ADDRESS — mint `vendor_profiles.business_slug`.
--
-- ── THE DEFECT ──────────────────────────────────────────────────────────────
-- `business_slug` is the ONLY key `/v/[slug]` and the bare root
-- (`setnayan.com/{slug}`) resolve a shop by, and NOTHING ever wrote it:
--
--   • `handle_new_vendor_user()` (20270401574089) does
--     `INSERT INTO public.vendor_profiles (user_id)` — no slug.
--   • `/open-shop`'s `becomeVendor` inserts the same bare row, then patches
--     business_name / owner / phone / email / services / event_types — no slug.
--   • No trigger and no function in the live database mentioned the column.
--     Checked against production `pg_proc` on 2026-08-06: the only two hits
--     (`resolve_custom_domain`, `public_venue_scene`) merely READ it.
--
-- The only writers were two server actions — `saveVendorProfile` and
-- `updateVendorWebsiteField` — and BOTH are gated on
-- `tierCaps().customWebsiteName`, which is true for PRO / ENTERPRISE / CUSTOM
-- only. Free, Verified and Solo shops therefore could never hold a slug at all;
-- the "Custom address" input is not even rendered for them, and My Shop told
-- them, verbatim: "No public address yet — a custom address is a Pro feature."
--
-- That gate was designed to gate CHOOSING a vanity address. Because no default
-- was ever minted, it silently became a gate on HAVING one. Live production
-- carried 2 vendor rows on 2026-08-06 and BOTH had `business_slug IS NULL`, so
-- the "clean auto-composed page" `lib/vendor-microsite.ts` promises Free and
-- Verified shops had no address to be reached at, and an Explore card for such
-- a shop renders `href="#"`.
--
-- ── WHAT THIS MIGRATION DOES NOT DO ─────────────────────────────────────────
-- It does NOT touch `public_visibility`. That column defaulting to 'hidden',
-- and being writable only by an admin (via `guard_vendor_profiles_entitlement`),
-- is an OWNER RULING — 2026-07-27, verbatim: "no. we only show shops that are
-- ready." Minting an address is not publishing: a hidden shop's page still
-- 404s for the public, and `/sitemap-vendors.xml` still filters on
-- `public_visibility = 'verified' AND verification_state = 'verified'`, so
-- nothing new reaches a crawler. Enforced by
-- `tests/db/vendor-business-slug-mint.db.test.ts` ("minting an address
-- publishes NOTHING").
--
-- ── SHAPE ───────────────────────────────────────────────────────────────────
-- Mirrors the ONE existing auto-mint on this table,
-- `generate_screen_name_for_vendor()` (20260714000000 + the collision fix in
-- 20270820111851): a SECURITY DEFINER generator, a bounded uniqueness-retry
-- loop, and a persistence rule that NEVER regenerates. Persistence is the
-- load-bearing part here — a public address is a promise. Moving it 404s every
-- link, QR and share already handed out.
--
-- Address format is the app's own `SLUG_RE` from
-- `app/vendor-dashboard/actions.ts`: /^[a-z0-9-]{3,32}$/.
--
-- Idempotent: CREATE OR REPLACE FUNCTION · DROP TRIGGER IF EXISTS · the
-- backfill only touches rows where `business_slug IS NULL`.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Reserved words.
--
-- Vendors, events and users all live in ONE top-level namespace
-- (`setnayan.com/{slug}`), so a minted address must never be a real route.
-- `app/[slug]/page.tsx` answers `RESERVED_SLUGS.has(slug)` with notFound(),
-- which means a shop that minted 'explore' would hold an address that resolves
-- NOWHERE — a silent dead shop, not a shadowed route.
--
-- ⚠ THIS LIST IS THE SECOND COPY. The first is `apps/web/lib/reserved-slugs.ts`;
-- the database cannot import it. Two hand-typed lists rot silently, so they are
-- compared MECHANICALLY by `tests/db/vendor-business-slug-mint.db.test.ts`
-- ("every word reserved in lib/reserved-slugs.ts is reserved in the database"),
-- which feeds the TypeScript set into this function and fails naming any word
-- that is missing here. Add a word there ⇒ that test tells you to add it here.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.business_slug_is_reserved(p_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(coalesce(p_slug, '')) = ANY (ARRAY[
    -- auth / account / system
    'about', 'admin', 'api', 'auth', 'contact', 'dashboard', 'dpo',
    'forgot-password', 'health', 'help', 'join', 'legal', 'login', 'logout',
    'privacy', 'register', 'reset-password', 'settings', 'signup', 'support',
    'terms',
    -- routing namespaces / prefixes
    'u', 'v', 'vendor', 'vendor-dashboard', 'venue', 'venues',
    -- real top-level product / marketing routes
    'acceptable-use', 'alaala', 'blog', 'cookies', 'download', 'explore',
    'features', 'for-vendors', 'how-it-works', 'monogram', 'our-story', 'pa3d',
    'palogo', 'panood', 'papic', 'patiktok', 'pawebsite', 'pricing',
    'realstories', 'refunds', 'setnayan-ai', 'storytellers', 'tour', 'vendors',
    'waitlist', 'wall', 'why-setnayan',
    -- Next.js internals / special files
    '_next', 'static', 'public', 'manifest.json', 'sw.js', 'icon-192.svg',
    'icon-512.svg'
  ]::text[]);
$$;

COMMENT ON FUNCTION public.business_slug_is_reserved(TEXT) IS
  'TRUE when a slug is a reserved top-level word. MIRRORS apps/web/lib/reserved-slugs.ts '
  '— the two are compared mechanically by tests/db/vendor-business-slug-mint.db.test.ts, '
  'which fails naming any word present there and missing here.';

-- ----------------------------------------------------------------------------
-- 2. Slugify a business name into the app's address format.
--
-- Latin-1 accents are transliterated first (Peña → pena, Café → cafe) rather
-- than being replaced with hyphens, which is common enough in PH business names
-- to be worth the one `translate`. '&' becomes ' and ' before the sweep so
-- "Bloom & Vine" reads as "bloom-and-vine", not "bloom-vine".
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.slugify_business_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    trim(BOTH '-' FROM
      regexp_replace(
        replace(
          translate(
            lower(coalesce(p_name, '')),
            'áàâäãåéèêëíìîïóòôöõúùûüýñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÝÑÇ',
            'aaaaaaeeeeiiiiooooouuuuyncaaaaaaeeeeiiiiooooouuuuync'
          ),
          '&', ' and '
        ),
        '[^a-z0-9]+', '-', 'g'
      )
    ),
    ''
  );
$$;

COMMENT ON FUNCTION public.slugify_business_name(TEXT) IS
  'Business name → the app SLUG_RE alphabet ([a-z0-9-]), accents transliterated, '
  '& spelled out, runs collapsed, edges trimmed. NULL when nothing survives.';

-- ----------------------------------------------------------------------------
-- 3. Clip a candidate to the 32-char ceiling without leaving a trailing hyphen
--    (a trailing '-' is legal under SLUG_RE but reads as a broken URL).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.clip_business_slug(p_base TEXT, p_max INT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(trim(BOTH '-' FROM left(coalesce(p_base, ''), GREATEST(p_max, 0))), '');
$$;

-- ----------------------------------------------------------------------------
-- 4. The generator.
--
-- PERSISTENCE RULE (first branch): once a shop holds an address it is never
-- reissued. A rename keeps the old URL working; a Pro vendor changing it
-- deliberately still goes through the server action, which is unaffected here.
--
-- SOURCES, in order:
--   a. the business name                    → 'bloom-and-vine-studio'
--   b. the name + 4 chars of the public id  → when (a) is 1–2 chars ('yo-bwwq')
--   c. the public id, lowercased            → when nothing survives ('s89b-…')
-- Deliberately NOT the screen_name: that is the hybrid-anonymity display
-- mechanic (NULL for venues, revealed on a separate clock) and an address must
-- not move when a name is revealed.
--
-- UNIQUENESS: `vendor_profiles_business_slug_unique` is a PARTIAL, expression
-- index on LOWER(business_slug), so ON CONFLICT cannot name it. The loop probes
-- first AND catches unique_violation, so a concurrent registration retries
-- instead of aborting the other vendor's signup transaction. Events are probed
-- too — `app/[slug]/page.tsx` resolves an event BEFORE a vendor at the same
-- bare slug, so an event-shadowed address would be dead on arrival.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_business_slug_for_vendor(
  p_vendor_profile_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing     TEXT;
  v_name         TEXT;
  v_public_id    TEXT;
  v_base         TEXT;
  v_candidate    TEXT;
  v_suffix       TEXT;
  v_attempt      INT := 1;
  v_max_attempts CONSTANT INT := 50;
  v_taken        BOOLEAN;
BEGIN
  SELECT business_slug, business_name, public_id
    INTO v_existing, v_name, v_public_id
    FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_profile_id;

  -- Never reissue a live address.
  IF v_existing IS NOT NULL THEN
    RETURN;
  END IF;

  -- An unnamed shop gets NOTHING. The bare row the signup trigger and
  -- /open-shop create is nameless for a beat; minting there would burn the
  -- opaque fallback address and the persistence rule would then keep it
  -- forever, even though the vendor names the shop one statement later.
  IF v_name IS NULL OR length(trim(v_name)) = 0 THEN
    RETURN;
  END IF;

  v_base := public.slugify_business_name(v_name);

  -- 1–2 chars is legal for a business name but not for an address; borrow four
  -- characters of the row's own public id rather than discarding the name.
  IF v_base IS NOT NULL AND length(v_base) < 3 AND v_public_id IS NOT NULL THEN
    v_base := v_base || '-' || lower(right(v_public_id, 4));
  END IF;

  -- Nothing survived (a name that is entirely punctuation or non-Latin script).
  IF v_base IS NULL OR length(v_base) < 3 THEN
    v_base := lower(coalesce(v_public_id, ''));
  END IF;

  IF length(v_base) < 3 THEN
    -- No name, no public id: leave it NULL rather than mint a junk address.
    RETURN;
  END IF;

  WHILE v_attempt <= v_max_attempts LOOP
    IF v_attempt = 1 THEN
      v_candidate := public.clip_business_slug(v_base, 32);
    ELSE
      v_suffix := '-' || v_attempt::text;
      v_candidate :=
        public.clip_business_slug(v_base, 32 - length(v_suffix)) || v_suffix;
    END IF;

    IF v_candidate IS NOT NULL AND length(v_candidate) >= 3 THEN
      SELECT
        public.business_slug_is_reserved(v_candidate)
        OR EXISTS (
          SELECT 1 FROM public.vendor_profiles vp
           WHERE lower(vp.business_slug) = lower(v_candidate)
        )
        OR EXISTS (
          SELECT 1 FROM public.events e
           WHERE lower(e.slug) = lower(v_candidate)
        )
      INTO v_taken;

      IF NOT v_taken THEN
        BEGIN
          UPDATE public.vendor_profiles
             SET business_slug = v_candidate
           WHERE vendor_profile_id = p_vendor_profile_id
             AND business_slug IS NULL;
          RETURN;
        EXCEPTION WHEN unique_violation THEN
          -- Lost a race to a concurrent registration; fall through and retry.
          NULL;
        END;
      END IF;
    END IF;

    v_attempt := v_attempt + 1;
  END LOOP;

  -- 50 collisions on one name. Fall back to the row's own public id, which is
  -- unique by construction, and only then give up.
  v_candidate := lower(coalesce(v_public_id, ''));
  IF length(v_candidate) >= 3 AND NOT public.business_slug_is_reserved(v_candidate) THEN
    BEGIN
      UPDATE public.vendor_profiles
         SET business_slug = v_candidate
       WHERE vendor_profile_id = p_vendor_profile_id
         AND business_slug IS NULL;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.generate_business_slug_for_vendor(UUID) IS
  'Mints vendor_profiles.business_slug once, from the business name (public id '
  'as fallback). NEVER reissues — a public address is a promise. Does NOT touch '
  'public_visibility: an address is not a listing (owner ruling 2026-07-27).';

-- SECURITY DEFINER + public schema ⇒ Supabase''s stock EXECUTE-to-PUBLIC would
-- put this on the anon RPC surface (tests/db/anon-rpc-surface.db.test.ts). It is
-- internal trigger machinery; nobody calls it over REST.
REVOKE ALL ON FUNCTION public.generate_business_slug_for_vendor(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.business_slug_is_reserved(TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.slugify_business_name(TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clip_business_slug(TEXT, INT)
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. The trigger.
--
-- AFTER INSERT OR UPDATE **OF business_name** — the naming moment, whichever
-- path it arrives by (the signup trigger's bare row + /open-shop's patch, My
-- Shop's inline rename, a seed that inserts the name inline). Gating on the
-- column means the generator's own `SET business_slug = …` cannot re-enter it:
-- `UPDATE OF` fires only when the named column appears in the SET list, and it
-- does not. The `business_slug IS NOT NULL → RETURN` guard is the second belt.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_vendor_profiles_generate_business_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.business_slug IS NULL
     AND NEW.business_name IS NOT NULL
     AND length(trim(NEW.business_name)) > 0 THEN
    PERFORM public.generate_business_slug_for_vendor(NEW.vendor_profile_id);
  END IF;
  RETURN NULL;  -- AFTER trigger: return value is ignored.
END;
$$;

REVOKE ALL ON FUNCTION public.tg_vendor_profiles_generate_business_slug()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_profiles_generate_business_slug
  ON public.vendor_profiles;
CREATE TRIGGER vendor_profiles_generate_business_slug
  AFTER INSERT OR UPDATE OF business_name ON public.vendor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_vendor_profiles_generate_business_slug();

-- ----------------------------------------------------------------------------
-- 6. Backfill.
--
-- Every named shop that predates the trigger. On production (2026-08-06) that
-- is 2 rows, both `business_slug IS NULL`. Ordered by created_at so the older
-- shop wins the shorter address on a name collision. Re-running is a no-op:
-- the generator returns immediately on a row that already has one.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT vendor_profile_id
      FROM public.vendor_profiles
     WHERE business_slug IS NULL
       AND business_name IS NOT NULL
       AND length(trim(business_name)) > 0
     ORDER BY created_at
  LOOP
    PERFORM public.generate_business_slug_for_vendor(r.vendor_profile_id);
  END LOOP;
END$$;

COMMIT;
