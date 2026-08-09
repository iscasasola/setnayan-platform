-- A shop's web address is written once and never moves.
--
-- Owner 2026-08-10, stated twice — the second time to settle it:
--   "slug cannot be renamed so they need to pick their preferred slug."
--   "they can rename it during creation so they can check which is available.
--    but whatever they choose here will be permanent."
--
-- ⚠ THE UI CHECK IS THE BUTTON, NOT THE DOOR. The companion PR removes
-- `business_slug` from the My Shop website editor and its server allowlist, and
-- that is worth doing — but it is not the boundary. `vendor_profiles_owner` is
-- `FOR ALL` on `user_id = auth.uid()`, and the column carries the `authenticated`
-- grant, so **any vendor on any tier can PATCH their own business_slug straight
-- through PostgREST today**, with no UI involved. A promise the database does not
-- keep is not a promise. This trigger is where the rule actually lives.
--
-- WHAT IT REFUSES: any UPDATE that changes a business_slug which is already set.
-- Setting one for the first time (NULL → value) is the creation path and stays
-- open — that is `/open-shop` writing the vendor's chosen address, and the
-- generator trigger minting a fallback. Clearing one (value → NULL) is refused
-- too: an address that vanishes is as broken as one that moves, and nothing in
-- the product has a reason to do it.
--
-- ── WHY THIS MATTERS MORE THAN A TIDY RULE ──────────────────────────────────
-- The address is printed. Save-the-dates go out 6–12 months ahead, QR codes are
-- issued per customer (`vendor_locked_qr_tokens`), and the sitemap has published
-- it. Shops have **no rename forwarding** — `slug_change_log` supports
-- `entity_type = 'vendor'` but nothing has ever written a vendor row, and the
-- bare-root resolver reads it only for renamed EVENTS. So a moved shop address
-- does not redirect: it 404s, for everyone holding the old one, forever.
--
-- ── THE ESCAPE HATCH ────────────────────────────────────────────────────────
-- Modelled on `guard_vendor_tier_no_silent_downgrade` (20271115090000): a
-- PER-STATEMENT setting, not a standing exemption, so the default stays closed
-- and an escape has to be typed on purpose.
--
--   SET LOCAL setnayan.allow_slug_change = 'on';
--
-- Deliberately NOT a role check. `is_admin()` reads `auth.uid()`, which is NULL
-- under service_role, so an is_admin() hatch would be open to every server
-- action and closed to the actual admin — precisely backwards.
--
-- ⏭ NO ADMIN SCREEN USES THIS YET, and that is a real gap worth naming rather
-- than papering over: as of today **nobody can correct a shop's address**, not
-- even Setnayan. A typo'd or trademark-infringing address has no remedy but a
-- new shop. The hatch is here so that screen is a small change when it is
-- wanted; building it uninvited would be inventing product.

CREATE OR REPLACE FUNCTION public.guard_business_slug_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Not a change → nothing to police. IS NOT DISTINCT FROM so a NULL → NULL
  -- update is not mistaken for a change.
  IF NEW.business_slug IS NOT DISTINCT FROM OLD.business_slug THEN
    RETURN NEW;
  END IF;

  -- First write. The creation path (/open-shop) and the generator trigger both
  -- land here, and both are legitimate.
  IF OLD.business_slug IS NULL THEN
    RETURN NEW;
  END IF;

  -- Deliberate correction, opted into for this statement only.
  IF COALESCE(current_setting('setnayan.allow_slug_change', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'SHOP_ADDRESS_IMMUTABLE: this shop already lives at "%" and an address is '
    'permanent (owner 2026-08-10). Save-the-dates, printed QR codes and the '
    'sitemap point at it, and shops have no rename forwarding — moving it 404s '
    'everyone holding the old one. A deliberate correction must set '
    'setnayan.allow_slug_change = ''on'' for that statement.',
    OLD.business_slug
    USING ERRCODE = 'check_violation';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_business_slug_immutable()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.guard_business_slug_immutable() IS
  'Refuses any UPDATE that changes an already-set vendor_profiles.business_slug. '
  'NULL -> value (creation) is allowed; value -> anything else is not. Per-statement '
  'escape: SET LOCAL setnayan.allow_slug_change = ''on''. Owner 2026-08-10.';

DROP TRIGGER IF EXISTS vendor_profiles_business_slug_immutable ON public.vendor_profiles;
CREATE TRIGGER vendor_profiles_business_slug_immutable
  BEFORE UPDATE OF business_slug ON public.vendor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_business_slug_immutable();

-- `UPDATE OF business_slug` fires only when the column appears in the SET list,
-- so the ordinary profile save — which never mentions it — pays nothing.
--
-- ⚠ It fires on the GENERATOR's own `SET business_slug = …` too. That is safe by
-- construction: `generate_business_slug_for_vendor` writes only
-- `WHERE business_slug IS NULL`, so OLD.business_slug is NULL on every row it
-- touches and the second branch above returns NEW. Verified against migration
-- 20271123576947, which is the live definition.
