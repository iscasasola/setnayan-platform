-- remove_led_wall_backdrop
--
-- ─── WHAT THIS CLOSES ──────────────────────────────────────────────────────
-- The LED wall backdrop was sold (bundled into ANIMATED_MONOGRAM ₱1,000) and
-- could never be delivered. A couple picked a template, set a loop length and
-- pressed "Save draft & queue for render" — and nothing anywhere produced a
-- file. Verified 2026-08-11 against prod and origin/main, not against a doc:
--   • `led_background_renders`  — 0 rows, 0 writers, 0 readers in the repo.
--   • `led_background_configs`  — 0 rows (the drafts the maker saved).
--   • no worker directory, no wrangler config, no Remotion, no server ffmpeg.
--     `@ffmpeg/ffmpeg` is the WASM build and runs in the visitor's browser.
--   • `orders` — 0 rows overall. Nothing was ever bought, so nobody is owed a
--     refund and no owner loses access.
--
-- Owner ruled 2026-08-11, choosing removal over building the render farm:
-- "remove wall backdrop". The alternative was the only always-on paid server
-- in the whole product — everything else we render runs client-side.
--
-- ─── WHAT IS *NOT* REMOVED ─────────────────────────────────────────────────
-- Hiring an LED wall VENDOR stays. `led_background` is also a couple PLAN item
-- and `led_wall` a taxonomy tile; a couple booking a rental company is a real,
-- working flow. Only the Setnayan-MADE backdrop goes. The plan item's copy was
-- corrected in the same PR to stop claiming Setnayan renders the loop.
--
-- ⚠ `setnayan_pailaw` (the first-party taxonomy LEAF) is deliberately LEFT IN
-- PLACE. Removing a leaf reshapes the vendor service tree and can strand shops
-- that selected it; that is a separate, riskier change and is named as debt in
-- the PR rather than smuggled in here.
--
-- Idempotent throughout: re-applying is a no-op.

BEGIN;

-- ── 1 · Stop recommending it to vendors ────────────────────────────────────
-- Three LIVE rows pitched the backdrop to vendors in adjacent categories
-- (led_wall · lights_sound · stylist_decorator). Deleted, not deactivated:
-- the row IS the recommendation, and an inactive row for a service that no
-- longer exists is a trap for the next reader.
DELETE FROM public.vendor_service_recommendations
 WHERE service_code = 'LIVE_BACKGROUND';

-- ── 2 · Stop bundling it ───────────────────────────────────────────────────
-- MEDIA_PACK listed LIVE_BACKGROUND as a child. MEDIA_PACK is itself retired,
-- but a bundle that still lists a deleted component would resolve to a grant
-- for a surface that 404s.
DELETE FROM public.bundle_components
 WHERE component_service_code = 'LIVE_BACKGROUND';

-- ── 3 · Keep the catalog row off sale ──────────────────────────────────────
-- Already is_active=false since the 2026-07-22 bundle restructure. Asserted
-- here so the migration is self-contained: replaying this file onto any
-- database leaves nothing sellable behind. The row is KEPT (not deleted) —
-- the retired SKU staying retired is exactly what
-- tests/db/sellable-promises.db.test.ts pins, and deleting it would remove the
-- evidence that it is off sale.
UPDATE public.platform_retail_catalog_v2
   SET is_active = FALSE,
       updated_at = NOW()
 WHERE service_code = 'LIVE_BACKGROUND'
   AND is_active IS DISTINCT FROM FALSE;

-- ── 4 · Drop the two tables the feature owned ──────────────────────────────
-- Both empty. `led_background_renders` is the queue nothing ever wrote to;
-- `led_background_configs` held the saved drafts. Renders first — it carries
-- the FK to configs. Nothing else in the database depends on either (checked
-- in prod: no other foreign keys, no views, no matviews).
DROP TABLE IF EXISTS public.led_background_renders;
DROP TABLE IF EXISTS public.led_background_configs;

COMMIT;

-- ── VERIFY (run against prod after deploy — the OBJECT, not the log) ───────
-- SELECT to_regclass('public.led_background_renders')  IS NULL AS renders_gone,
--        to_regclass('public.led_background_configs')  IS NULL AS configs_gone,
--        (SELECT count(*) FROM public.vendor_service_recommendations
--          WHERE service_code = 'LIVE_BACKGROUND')              AS recs_left,
--        (SELECT count(*) FROM public.bundle_components
--          WHERE component_service_code = 'LIVE_BACKGROUND')    AS bundles_left,
--        (SELECT is_active FROM public.platform_retail_catalog_v2
--          WHERE service_code = 'LIVE_BACKGROUND')              AS still_active;
-- Expected: t · t · 0 · 0 · f
