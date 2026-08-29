-- ============================================================================
-- THE UNIT IS A CREDIT, IN THE CATALOG TOO
--
-- ⚖ OWNER 2026-08-29: *"please make sure to change shots to credits"*, then
--   *"fix it"* when a sweep of the live site showed the new word stopping at
--   `/papic`. `/pricing` said "shots" 137 times — and the link that took a
--   customer there is the one on the Papic page reading "See every amount".
--   They read one product on one page and a different vocabulary on the next
--   click.
--
-- 🔑 SEVENTEEN ROWS PRODUCE MOST OF THAT COUNT. Every ladder line on /pricing
--    ("₱70 to add 100 shots") is rendered from these titles, so no amount of
--    code editing could have fixed them — the word is DATA.
--
-- ⚠ REWRITTEN BY PATTERN, NOT BY SEVENTEEN HARDCODED STRINGS. The rows differ
--   only by a number, the pattern is exact, and `replace()` is naturally
--   idempotent here: once "shots" is gone a second run matches nothing. A
--   hardcoded list would also have to be re-typed the next time a rung is
--   added — which is precisely how the price seed drifted.
--
-- 🔒 SCOPED TO `PAPIC_GUEST%` ON PURPOSE. `PAPIC_CAMERA_MINI_DAY` also says
--   "shots" and is deliberately left alone: it is a superseded row whose title
--   carries its own "(superseded 2026-08-11)" marker, and rewording a retired
--   product's title makes its history harder to read for no customer benefit.
--
-- ⛔ "shot" IS NOT WRONG EVERYWHERE AND IS NOT BEING PURGED. A photograph is
--   still a shot: "Take the shot", "Next shot", "that shot was too large to
--   save" are correct English and stay. Only the CURRENCY meaning moves. A
--   blanket rename would have broken real copy in the capture screens.
-- ============================================================================

BEGIN;

UPDATE public.platform_retail_catalog_v2
SET title = replace(title, ' shots', ' credits')
WHERE service_code LIKE 'PAPIC_GUEST%'
  AND title LIKE '% shots%';

UPDATE public.platform_retail_catalog_v2
SET description = replace(description, ' shots ', ' credits ')
WHERE service_code LIKE 'PAPIC_GUEST%'
  AND description LIKE '% shots %';

-- Post-condition: no PAPIC_GUEST row may still advertise the old unit.
DO $$
DECLARE stragglers int;
BEGIN
  SELECT count(*) INTO stragglers
  FROM public.platform_retail_catalog_v2
  WHERE service_code LIKE 'PAPIC_GUEST%'
    AND (title ILIKE '%shot%' OR description ILIKE '%shot%');
  IF stragglers > 0 THEN
    RAISE EXCEPTION 'a Papic rung still says "shot" in its title or description (% rows)', stragglers;
  END IF;
END $$;

COMMIT;
