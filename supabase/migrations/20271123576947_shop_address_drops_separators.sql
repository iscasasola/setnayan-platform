-- The shop address is the shop NAME with the spaces taken out.
--
-- Owner 2026-08-09, on being shown that "Banawe Florals" was minting
-- `banawe-florals`: **"remove spaces for the slug."** Their own worked example
-- was `www.setnayan.com/banaweflorals`.
--
-- WHAT CHANGES. `slugify_business_name` collapsed every run of non-alphanumeric
-- characters into a HYPHEN; it now DROPS them. The rest of the pipeline is
-- untouched: lowercase first, transliterate accented Latin, expand `&` to the
-- word "and", and return NULL when nothing survives.
--
--   Banawe Florals        banawe-florals          → banaweflorals
--   Bloom & Vine Studio   bloom-and-vine-studio   → bloomandvinestudio
--   Mañana Photo Co.      manana-photo-co         → mananaphotoco
--   Kai's Cakes!!         kai-s-cakes             → kaiscakes
--
-- ⚠ EXISTING ADDRESSES DO NOT MOVE, and that is the point. The generator's
-- first branch returns early when `business_slug IS NOT NULL` — an address is
-- never reissued, because a printed invitation or a save-the-date sent months
-- ago points at it. `saysay-live-band-and-hosting-fix` keeps its hyphens
-- forever. This changes what the NEXT shop is minted, nothing else. No backfill,
-- deliberately: a backfill here would silently break every address already
-- handed out.
--
-- ⚠ HYPHENS REMAIN LEGAL IN A MANUALLY CHOSEN ADDRESS. `VENDOR_SLUG_RE`
-- (`^[a-z0-9-]{3,32}$`) is unchanged, so a vendor renaming their address on My
-- Shop may still type one. This governs only what is MINTED from the name.
--
-- ── The collision suffix loses its hyphen too ────────────────────────────────
-- Owner, same message: *"must be available. if not available we will add a
-- numerical value integer?"* — that already existed; the loop probes reserved
-- words, every other vendor slug AND every event slug, then appends a counter.
-- Only its separator changes, so the suffix matches the new house style:
--   taken: banaweflorals   → banaweflorals2 → banaweflorals3 …
-- (was `banaweflorals-2`.) Fifty attempts, then the row's own public id, exactly
-- as before.
--
-- 🔑 A NAME COLLIDING WITH A SUFFIXED ADDRESS IS ALREADY SAFE. A second shop
-- literally called "Banawe Florals 2" now slugifies to `banaweflorals2`, which
-- the first collision may already hold — the loop's own taken-check catches it
-- and moves to `banaweflorals22`. No new hazard; the probe was always the
-- authority, never the arithmetic.
--
-- 🛡 `apps/web/lib/business-slug.ts` mirrors this in TypeScript so the wizard can
-- show a vendor their address while they type. The two are compared
-- MECHANICALLY over a corpus by `tests/db/business-slug-mirror.db.test.ts` — a
-- preview that drifts from this function is a promise the product does not keep.

CREATE OR REPLACE FUNCTION public.slugify_business_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    regexp_replace(
      replace(
        translate(
          lower(coalesce(p_name, '')),
          'áàâäãåéèêëíìîïóòôöõúùûüýñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÝÑÇ',
          'aaaaaaeeeeiiiiooooouuuuyncaaaaaaeeeeiiiiooooouuuuync'
        ),
        '&', ' and '
      ),
      -- DROP the separators instead of collapsing them to '-'. With nothing left
      -- to trim there is no edge-hyphen case, which is why the surrounding
      -- trim(BOTH '-') is gone as well.
      '[^a-z0-9]+', '', 'g'
    ),
    ''
  );
$$;

COMMENT ON FUNCTION public.slugify_business_name(TEXT) IS
  'Business name → address: lowercased, accents transliterated, & spelled out, '
  'then every non-alphanumeric character REMOVED (owner 2026-08-09 — "remove '
  'spaces for the slug"; "Banawe Florals" → "banaweflorals"). NULL when nothing '
  'survives. Existing slugs are never reissued, so pre-2026-08-09 hyphenated '
  'addresses keep working. Mirrored in apps/web/lib/business-slug.ts and compared '
  'mechanically by tests/db/business-slug-mirror.db.test.ts.';

-- ── The generator: same logic, hyphen-free suffix ───────────────────────────
-- Replaced wholesale (not patched) because a plpgsql body cannot be edited in
-- place. This is migration 20271117527966's function with ONE line changed:
-- `v_suffix := '-' || v_attempt::text` → `v_suffix := v_attempt::text`.

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

  IF v_name IS NULL OR length(trim(v_name)) = 0 THEN
    RETURN;
  END IF;

  v_base := public.slugify_business_name(v_name);

  -- 1–2 chars is legal for a business name but not for an address; borrow four
  -- characters of the row's own public id rather than discarding the name.
  -- Hyphen-free now, to match the house style above.
  IF v_base IS NOT NULL AND length(v_base) < 3 AND v_public_id IS NOT NULL THEN
    v_base := v_base || lower(right(v_public_id, 4));
  END IF;

  IF v_base IS NULL OR length(v_base) < 3 THEN
    v_base := lower(coalesce(v_public_id, ''));
  END IF;

  IF length(v_base) < 3 THEN
    RETURN;
  END IF;

  WHILE v_attempt <= v_max_attempts LOOP
    IF v_attempt = 1 THEN
      v_candidate := public.clip_business_slug(v_base, 32);
    ELSE
      v_suffix := v_attempt::text;
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
          NULL;
        END;
      END IF;
    END IF;

    v_attempt := v_attempt + 1;
  END LOOP;

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
  'Mints vendor_profiles.business_slug from the business name, ONCE — an address '
  'is never reissued. Probes reserved words, every other vendor slug and every '
  'event slug; on a collision appends a counter with NO separator '
  '(banaweflorals2), 50 attempts, then the row public_id. Owner 2026-08-09.';
