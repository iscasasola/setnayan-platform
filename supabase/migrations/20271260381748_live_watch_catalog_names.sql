-- live_watch_catalog_names
--
-- 📺 "LIVE STUDIO" → "LIVE WATCH" IN THE PRICE LIST — NAMES ONLY.
--
-- Owner, 2026-09-30 (DECISION_LOG "THE LIVE SERVICE IS 'LIVE WATCH'"): the
-- live-streaming service reads Live Watch everywhere a couple or guest sees it;
-- "code keys, routes and SKU keys unchanged". Owner, 2026-10-02 (tracker d2):
-- rename it in the admin price list "through the pipeline, prices untouched".
--
-- The catalogue rows are what checkout and receipts read for a product's name
-- (`platform_retail_catalog_v2.title`), plus the sibling catalogues that carry
-- a customer-facing name (`platform_package_catalog`, `service_catalog`).
--
-- Measured in production 2026-10-02: both LIVE_STUDIO rows' TITLES already read
-- "Live Watch" (renamed in Admin by hand); one DESCRIPTION
-- (LIVE_STUDIO_HOSTED_CHANNEL) still says "Live Studio" twice. In a fresh
-- replay the seeded titles still say "Live Studio". This migration closes both:
-- every text that names the product, in every catalogue, says Live Watch.
--
-- 🔒 TOUCHES ONLY title / description / display_name. No price, no SKU code,
-- no is_active, no billing column. `live-watch-rename-is-names-only.db.test.ts`
-- snapshots every other column before and after and fails on any difference.
-- `replace()` on rows that no longer contain the old name changes nothing, so
-- re-applying is a no-op (idempotent).

UPDATE public.platform_retail_catalog_v2
   SET title = replace(title, 'Live Studio', 'Live Watch'),
       description = replace(description, 'Live Studio', 'Live Watch')
 WHERE title LIKE '%Live Studio%'
    OR description LIKE '%Live Studio%';

UPDATE public.platform_package_catalog
   SET title = replace(title, 'Live Studio', 'Live Watch'),
       description = replace(description, 'Live Studio', 'Live Watch')
 WHERE title LIKE '%Live Studio%'
    OR description LIKE '%Live Studio%';

UPDATE public.service_catalog
   SET display_name = replace(display_name, 'Live Studio', 'Live Watch'),
       description = replace(description, 'Live Studio', 'Live Watch')
 WHERE display_name LIKE '%Live Studio%'
    OR description LIKE '%Live Studio%';
