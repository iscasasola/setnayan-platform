-- ─────────────────────────────────────────────────────────────────────────────
-- Record which country a shop's pin is in, instead of assuming it.
--
-- Owner 2026-08-10: *"just place that variable. so it will be easy to add
-- countries next time. but for now, it is true that it will be just philippines
-- for now for the vendors."*
--
-- ── WHY NOW, WHILE THERE IS ONLY ONE ────────────────────────────────────────
-- Nominatim has always returned the country and the app has always discarded
-- it, so every vendor's country has been an ASSUMPTION — true today only
-- because `lib/geo.ts` restricts both lookups to `countrycodes=ph`. The moment
-- that line changes, every existing row becomes a country we never wrote down.
--
-- 🔑 ADDING THE COLUMN WHILE ONE VALUE IS CORRECT IS THE CHEAP MOMENT. The
-- backfill below is provably true right now and unprovable later: every shop in
-- the table was pinned through a Philippines-restricted geocoder. Doing this
-- after the map opens would mean guessing which of the old rows were PH.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS hq_country TEXT;

-- ISO-3166 alpha-2, uppercase. A CHECK on the SHAPE, deliberately not on the
-- VALUE: constraining it to 'PH' would make opening a second country a
-- migration under live data, which is the thing this column exists to avoid.
ALTER TABLE public.vendor_profiles
  DROP CONSTRAINT IF EXISTS vendor_profiles_hq_country_shape;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_hq_country_shape
  CHECK (hq_country IS NULL OR hq_country ~ '^[A-Z]{2}$');

-- Backfill: every existing shop was pinned through a PH-restricted geocoder,
-- so this states a fact rather than a default. Only rows that actually have a
-- location — a shop with no pin has no country, and NULL says "not known"
-- where 'PH' would be a guess.
UPDATE public.vendor_profiles
   SET hq_country = 'PH'
 WHERE hq_country IS NULL
   AND (hq_latitude IS NOT NULL OR btrim(coalesce(hq_address, '')) <> '');

COMMENT ON COLUMN public.vendor_profiles.hq_country IS
  'ISO-3166 alpha-2 country of the shop''s pin, from the geocoder rather than '
  'assumed. PH for every row today because lib/geo.ts restricts both lookups to '
  'countrycodes=ph. NULL means no location has been set — not "probably PH". '
  'The contact-number rule is chosen by this value (lib/phone-rules.ts).';
