-- the_catalogue_forgets_what_it_retired
--
-- Owner ruled 2026-08-28, of the 43 switched-off prices: "delete them."
--
-- 35 go. EIGHT STAY, and the reason is the whole point of this migration:
-- application CODE reads their price by literal string, WITHOUT an is_active
-- filter, so no foreign key and no database-only safety check can see the
-- dependency. Deleting one would not move a price today — every one of the
-- eight has a byte-identical hardcoded fallback — the harm is that the row is
-- the ONLY handle the owner has on that price. Delete it and the figure freezes
-- inside the app, unreachable from the pricing screen.
--
-- ── THE EIGHT THAT STAY ──────────────────────────────────────────────────────
--   SETNAYAN_AI_B / _C / _D  → lib/setnayan-ai-type-pricing.ts AI_TIER_SKU is
--     the price of the assisted planner for 15 of 17 event types. Migration
--     20271139128584 says so in its own text: "Their prices are read regardless
--     of is_active. Do not tidy them by activating or deleting them."
--   SETNAYAN_AI_RENEW        → "switched off" means "not sold separately", not
--     retired. lib/setnayan-ai-event-pricing.ts reads it as the renewal price.
--
--   PAPIC_CAMERA_ROLL_DAY / _MINI_DAY / _LTD_DAY / _UNLIMITED_DAY
--     ⚠ NEW LOCK, 2026-08-29 — the per-row checklist this work was written from
--     graded these four "safe once their pointer is cleared". THAT IS WRONG, and
--     it is wrong by the checklist's own reasoning applied to the AI rows.
--     lib/papic-cameras.ts `fetchCameraRates` reads ALL FOUR by literal string
--     with NO is_active filter, and its output is not decoration:
--       • studio/papic/page.tsx renders `GuestCameraTierPicker` from
--         cameraRates.roll and cameraRates.unlimited — a LIVE buy surface gated
--         only on guest count, not on papic_tier_config.is_active;
--       • studio/papic/actions.ts feeds the same rates to computeCameraQuote,
--         which sets requested_total_php on a real `orders` row.
--     So two of these four are the price of a charge a couple can make today.
--     Measured: catalogue 100/50/50/200 vs the fallback constants 100/50/50/200
--     — identical, so nothing moves either way; the handle is what would be lost.
--     All four stay together because fetchCameraRates cross-falls-back
--     mini <-> roll, and half a rate table is worse than all of it.
--
-- ── WHAT WAS MEASURED BEFORE DELETING ────────────────────────────────────────
--   • Every foreign key into platform_retail_catalog_v2 (9) counted in prod:
--     22 of the 43 have a pointer, and after the two fixes below every
--     remaining pointer is ON DELETE CASCADE onto an already-inactive row.
--   • Every loose text column and every text[]/jsonb column whose name could
--     hold a service code: ZERO carry a retired code outside those 9 tables.
--   • orders.service_key: ZERO orders name any of the 43, ever.
--   • All four bundles in platform_package_catalog are is_active = false.
--   • Every `from('platform_retail_catalog_v2')` call site in app/ lib/
--     components/ read and classified by whether it filters is_active, whether
--     it reads a PRICE, and whether that price is rendered or charged.
--   ⚠ FALSE-NEGATIVE SHAPE, stated rather than buried: a service code assembled
--     at runtime (a prefix joined to a suffix) would match no search for the
--     whole word. Looked for; none found — papicRungSku() returns whole
--     constants. A code held in a hosting setting is not readable from here.
--
-- ── ONE ROW OF NON-CATALOGUE DATA IS REMOVED, DELIBERATELY ───────────────────
-- event_software_activations_v2 holds ONE row, and it is the only thing holding
-- LIVE_WALL (that FK is ON DELETE NO ACTION, so the catalogue delete would fail
-- outright without this). Recorded here because it is gone after this runs:
--   id d715d6d9-4244-4ebb-8a38-81cd2f9671d3 · service_code LIVE_WALL
--   event 947e7bab-893d-454d-b4c5-0a6e23f36009 (slug maria-and-jose,
--   events.is_sample = TRUE — a seeded demo, not a customer's celebration)
--   vendor 646c9457-3450-412e-8d60-7281224da157 · created 2026-06-20
--   is_reward_issued = FALSE, rewarded_at = NULL
-- Nothing reads that row for the wall any more: every wall surface says so in
-- its own comment ("the old event_software_activations_v2 read had no
-- payment-path writer") and the only writer left is /api/v1/manpower/
-- sync-device. And LIVE_WALL is in FREE_FOR_ALL_SKUS, which eventSkuActive
-- checks BEFORE any lookup — so that demo keeps its wall either way.

BEGIN;

-- 1 · Release the one activation holding LIVE_WALL. Scoped to the exact row.
DELETE FROM public.event_software_activations_v2
WHERE service_code = 'LIVE_WALL'
  AND event_id = '947e7bab-893d-454d-b4c5-0a6e23f36009'::uuid;

-- 2 · Delete the 35. One code per line: gitleaks reads a single-line
--     IN ('A','B','C') of SKU codes as a leaked API key.
DELETE FROM public.platform_retail_catalog_v2
WHERE is_active = FALSE
  AND service_code IN (
    'CALL_TIME_ESCALATOR',
    'CAMERA_BRIDGE',
    'EDITORIAL_PRO',
    'EVENT_SUBDOMAIN',
    'EVENT_WEBSITE',
    'HIGH_RES_ARCHIVE',
    'INDOOR_BLUEPRINT',
    'KWENTO',
    'LIVE_BACKGROUND',
    'LIVE_STUDIO_ROAM',
    'LIVE_WALL',
    'PABATI',
    'PAKULAY',
    'PANOOD_SYSTEM',
    'PANOOD_SYSTEM_MOBILE',
    'PAPIC_ADDON_STORIES',
    'PAPIC_GUEST_13K',
    'PAPIC_GUEST_16K',
    'PAPIC_GUEST_23K',
    'PAPIC_GUEST_26K',
    'PAPIC_GUEST_TOPUP',
    'PAPIC_ONE_100',
    'PAPIC_ONE_150',
    'PAPIC_SEATS',
    'PRO_RSVP',
    'PRO_WEBSITE',
    'RSVP_PRO_WEBSITE',
    'RSVP_WEBSITE',
    'SDE',
    'STD_PREMIUM_OPENINGS',
    'STD_VIDEO_UPLOAD',
    'TODAYS_FOCUS',
    'WEBSITE_GALLERY_UPLOAD',
    'WEBSITE_MAP_LINKING',
    'WEBSITE_THEMES'
  );

-- 3 · Say WHY the eight survive, where a reader of the live database will meet
--     it. A migration comment is not evidence and is never edited once applied;
--     a column comment is what somebody actually queries.
COMMENT ON COLUMN public.platform_retail_catalog_v2.is_active IS
  'FALSE means "not on sale" and is OVERLOADED — it does NOT mean "unused". '
  'Eight FALSE rows survive on purpose because application code reads their '
  'price by literal string with no is_active filter: SETNAYAN_AI_B/_C/_D (the '
  'assisted planner ladder for 15 event types), SETNAYAN_AI_RENEW (the renewal '
  'price — "not sold separately", not retired), and the four PAPIC_CAMERA_*_DAY '
  'rate rows (lib/papic-cameras.ts fetchCameraRates, which prices the guest '
  'camera tier picker and the camera order). Deleting any of them freezes that '
  'price inside the app. Before deleting a FALSE row, ask what CODE reads it — '
  'no foreign key can answer that question.';


-- ─────────────────────────────────────────────────────────────────────────────
-- AND EVENT HUB PRO SAYS WHAT IT ACTUALLY INCLUDES.
--
-- Owner ruled 2026-08-28: yes, say what it buys.
--
-- The stored description is the copy the PUBLIC pricing page reads (v2-catalog
-- selects `description` for every on-sale row), so it is the version a customer
-- meets before they ever open the buy surface. It listed FOUR inclusions and
-- THREE of them were untrue:
--   · "RSVP" — gated on nothing. Every couple has the RSVP page. The legacy
--     PRO_RSVP / RSVP_PRO_WEBSITE keys this SKU "collapsed" are described in
--     lib/couple-website-pro.ts as "dead/never-wired".
--   · "the on-the-day page" — gated on nothing either. Measured: every
--     eventCoupleWebsiteProActive call under app/[slug] resolves the WATERMARK
--     and nothing else.
--   · "Editorial PRO" — real once, FREE FOR EVERYONE since 2026-08-23
--     (FREE_FOR_ALL_SKUS, checked before any order lookup). It cannot be sold
--     as an inclusion while every couple already has it.
-- And it under-sold three things that ARE gated on this SKU and were never
-- mentioned: background music + a video hero, the couple's own photo gallery,
-- and their own site colours.
--
-- ⚖ COPY ONLY. The price, the ownership aliases and every gate are untouched;
-- SKU_OWNERSHIP_ALIASES still grants EDITORIAL_PRO and STD_PREMIUM_OPENINGS.
-- Whether the umbrella should be repriced now that one of its headline
-- inclusions is free is a PRICING call and the owner's alone — flagged, not
-- taken.
UPDATE public.platform_retail_catalog_v2
SET description =
      'Every premium touch on your Event Hub in one unlock — the cinematic '
      'Save-the-Date reveal, background music and a video across the top, your '
      'own photo gallery, and your own colours for the page and its buttons — '
      'plus the Setnayan mark taken off everywhere your guests see it: the '
      'page, the printable version, your story and the recap. The cinematic '
      'reveal comes only with this.',
    updated_at = NOW()
WHERE service_code = 'COUPLE_WEBSITE_PRO';

COMMIT;
