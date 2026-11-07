-- screen_name_remints_from_real_data
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
-- =============================================================================
-- A SCREEN NAME MINTED FROM THE FALLBACKS IS RE-MINTED ONCE THE REAL CITY AND
-- SERVICES ARRIVE — while the name is still unrevealed. (Owner, live 2026-11-07,
-- on his own new shop /v/rondomusical: the hero read "Philippines Wedding
-- Vendor #14" and the logo tile "PW", for a Quezon City music shop.)
--
-- THE BUG (measured, read-only, prod 2026-11-07):
--   /open-shop (`apps/web/app/open-shop/actions.ts`, the `.insert({ user_id: user.id })`
--   under "if (!vendorProfileId)") INSERTS the vendor_profiles row with NOTHING
--   but its user_id, then writes business_name · services · location_city in a
--   SECOND statement (`.update(patch)`). The AFTER INSERT trigger
--   `vendor_profiles_generate_screen_name` (20260714000000) fires on the EMPTY
--   row, so `generate_screen_name_for_vendor()` (fixed 20270820111851) takes
--   both fallbacks — city 'Philippines', label 'Wedding Vendor' — and its
--   persistence rule ("never regenerate") keeps that name forever. Every shop
--   opened through the wizard is born "Philippines Wedding Vendor #N".
--
--   And a second, independent half: even with the city and services present the
--   label came from `services[1]` only. /open-shop puts the COARSE category first
--   on purpose (`?category=` reads it), and coarse keys such as `band_dj` /
--   `florist` are not rows of canonical_service_schemas — so the label fell back
--   to 'Wedding Vendor' even when the very next service (`band_live_music` →
--   "Band / live music") had one. DECISION_LOG 2026-10-28 ("NO PRIMARY SERVICE"):
--   the anonymous name "must derive it without asking … e.g. the first ticked".
--   So the label is now the FIRST TICKED SERVICE THAT HAS A LABEL.
--
-- THE FIX (extends the existing generator + trigger; no new column):
--   1. `screen_name_label(services)` — the first service, in ticked order, with
--      a canonical_service_schemas.display_name_en; NULL when none has one. The
--      generator reads it (falling back to 'Wedding Vendor' exactly as before).
--      Where services[1] has a label — every name minted from real data so far —
--      the result is byte-identical to before.
--   2. `remint_fallback_screen_name(vendor_profile_id)` — re-mints a name ONLY
--      when all hold: it has one · `name_revealed_at IS NULL` · not a venue ·
--      and a FALLBACK SLOT it was built from can now be filled (it was built on
--      'Philippines' and the shop now has a city, OR on 'Wedding Vendor' and a
--      ticked service now has a label). It clears the four screen_name fields and
--      hands the row back to `generate_screen_name_for_vendor()`, so the mint,
--      the (city, display) namespace and the collision-retry loop are the SAME
--      code path as a signup — never a second copy of them.
--      A name built from real data is never touched (the persistence rule holds):
--      a real-city, real-label name has no fallback slot left to fill.
--   3. AFTER UPDATE OF location_city, services trigger → (2), only when either
--      column actually changed and the name is still unrevealed. Its own writes
--      touch only the screen_name columns, so it cannot re-fire itself.
--   4. One-time, re-runnable REPAIR of rows already stuck: (2) over every row.
--      Measured read-only on prod 2026-11-07: 3 rows qualify (rondomusical,
--      flowerstoreph, setnaprod); a second run touches 0.
--
-- `screen_name_slug` is not an address — no route resolves /v/<screen_name_slug>
-- (shops are reached by business_slug), so re-minting it breaks no link.
-- The old number's sequence row keeps its count; the freed number is not reused.
--
-- RLS: unchanged (no table). The three new functions are internal — EXECUTE is
-- revoked from PUBLIC / anon / authenticated; the triggers fire regardless.
-- =============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. The label: the first ticked service that has one.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.screen_name_label(p_services TEXT[])
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT css.display_name_en
    FROM unnest(COALESCE(p_services, '{}'::text[])) WITH ORDINALITY AS u(service, ord)
    JOIN public.canonical_service_schemas css
      ON css.canonical_service = u.service
   WHERE css.display_name_en IS NOT NULL
     AND length(trim(css.display_name_en)) > 0
   ORDER BY u.ord
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.screen_name_label(TEXT[]) IS
  'The anonymous screen name''s service label: the first ticked service (in services order) that has a canonical_service_schemas.display_name_en; NULL when none has one (the generator then uses ''Wedding Vendor''). DECISION_LOG 2026-10-28 NO PRIMARY SERVICE — derived, never asked. 20271319689851.';

REVOKE ALL ON FUNCTION public.screen_name_label(TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.screen_name_label(TEXT[]) FROM anon;
REVOKE ALL ON FUNCTION public.screen_name_label(TEXT[]) FROM authenticated;

-- ----------------------------------------------------------------------------
-- 2. The generator — byte-for-behavior 20270820111851 except the label source.
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
  v_display      TEXT;
  v_id           INT;
  v_full         TEXT;
  v_taxonomy     TEXT;
  v_slug         TEXT;
  v_existing     TEXT;
  v_attempt      INT := 0;
  v_max_attempts CONSTANT INT := 20;
BEGIN
  SELECT location_city, services, screen_name
    INTO v_city, v_services, v_existing
    FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_profile_id;

  -- Persistence rule: never regenerate. (A fallback name is cleared first by
  -- remint_fallback_screen_name(), which is the only re-mint door.)
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

  -- Label: the first ticked service that has one · fallback 'Wedding Vendor'.
  v_display := COALESCE(public.screen_name_label(v_services), 'Wedding Vendor');

  -- Mint + build the slug in the (city, display) namespace the UNIQUE index is
  -- keyed on, with the bounded collision retry (20270820111851).
  LOOP
    v_attempt := v_attempt + 1;

    v_id := public.next_screen_name_id(v_city, v_display);

    v_taxonomy := v_city || ' ' || v_display;
    v_full     := v_taxonomy || ' #' || v_id::TEXT;
    v_slug     := lower(regexp_replace(v_taxonomy || '-' || v_id::TEXT, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug     := trim(both '-' from v_slug);

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

  UPDATE public.vendor_profiles
     SET screen_name = v_full,
         screen_name_taxonomy = v_taxonomy,
         screen_name_id = v_id,
         screen_name_slug = v_slug
   WHERE vendor_profile_id = p_vendor_profile_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. The one re-mint door: a fallback name, unrevealed, whose fallback slot can
--    now be filled from real data. Returns TRUE when it re-minted.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.remint_fallback_screen_name(
  p_vendor_profile_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city      TEXT;
  v_services  TEXT[];
  v_name      TEXT;
  v_taxonomy  TEXT;
  v_revealed  TIMESTAMPTZ;
  v_city_slot  BOOLEAN;
  v_label_slot BOOLEAN;
BEGIN
  SELECT location_city, services, screen_name, screen_name_taxonomy, name_revealed_at
    INTO v_city, v_services, v_name, v_taxonomy, v_revealed
    FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_profile_id;

  IF v_name IS NULL OR v_taxonomy IS NULL THEN RETURN FALSE; END IF;
  -- A revealed name is the shop's public face already — never renumbered.
  IF v_revealed IS NOT NULL THEN RETURN FALSE; END IF;
  -- Venues show their real name; their screen name (if any) is left as it is.
  IF COALESCE(v_services, '{}'::text[]) && ARRAY['religious_venue', 'venue'] THEN RETURN FALSE; END IF;

  -- Which fallback slot was the name built on, and can it be filled now?
  v_city_slot := v_taxonomy LIKE 'Philippines %'
             AND v_city IS NOT NULL AND length(trim(v_city)) > 0;
  v_label_slot := v_taxonomy LIKE '% Wedding Vendor'
              AND public.screen_name_label(v_services) IS NOT NULL;

  IF NOT (v_city_slot OR v_label_slot) THEN RETURN FALSE; END IF;

  UPDATE public.vendor_profiles
     SET screen_name = NULL,
         screen_name_taxonomy = NULL,
         screen_name_id = NULL,
         screen_name_slug = NULL
   WHERE vendor_profile_id = p_vendor_profile_id;

  PERFORM public.generate_screen_name_for_vendor(p_vendor_profile_id);
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.remint_fallback_screen_name(UUID) IS
  'Re-mints a screen name built on a fallback (city ''Philippines'' and/or label ''Wedding Vendor'') once the real city / a labelled service is on the shop — only while name_revealed_at IS NULL and not a venue. Delegates the mint to generate_screen_name_for_vendor(). A name built from real data is never touched. 20271319689851 (owner 2026-11-07, /v/rondomusical).';

REVOKE ALL ON FUNCTION public.remint_fallback_screen_name(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remint_fallback_screen_name(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.remint_fallback_screen_name(UUID) FROM authenticated;

-- ----------------------------------------------------------------------------
-- 4. AFTER UPDATE OF location_city, services → the re-mint door.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_vendor_profiles_remint_fallback_screen_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.remint_fallback_screen_name(NEW.vendor_profile_id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_vendor_profiles_remint_fallback_screen_name() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_vendor_profiles_remint_fallback_screen_name() FROM anon;
REVOKE ALL ON FUNCTION public.tg_vendor_profiles_remint_fallback_screen_name() FROM authenticated;

DROP TRIGGER IF EXISTS vendor_profiles_remint_fallback_screen_name ON public.vendor_profiles;
CREATE TRIGGER vendor_profiles_remint_fallback_screen_name
  AFTER UPDATE OF location_city, services ON public.vendor_profiles
  FOR EACH ROW
  WHEN (
    NEW.screen_name IS NOT NULL
    AND NEW.name_revealed_at IS NULL
    AND (OLD.location_city IS DISTINCT FROM NEW.location_city
         OR OLD.services IS DISTINCT FROM NEW.services)
  )
  EXECUTE FUNCTION public.tg_vendor_profiles_remint_fallback_screen_name();

-- ----------------------------------------------------------------------------
-- 5. Repair — rows already stuck on a fallback name. Re-runnable: a repaired
--    row has no fillable fallback slot left, so a second run touches 0.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  v_id UUID;
  v_n  INT := 0;
BEGIN
  FOR v_id IN
    SELECT vendor_profile_id
      FROM public.vendor_profiles
     WHERE screen_name IS NOT NULL
       AND name_revealed_at IS NULL
       AND (screen_name_taxonomy LIKE 'Philippines %' OR screen_name_taxonomy LIKE '% Wedding Vendor')
     ORDER BY created_at, vendor_profile_id
  LOOP
    IF public.remint_fallback_screen_name(v_id) THEN
      v_n := v_n + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'screen_name_remints_from_real_data: re-minted % fallback screen name(s) from real city/services.', v_n;
END$$;

COMMIT;
