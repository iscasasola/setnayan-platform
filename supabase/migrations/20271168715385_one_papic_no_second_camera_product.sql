-- ONE PAPIC. The cameras tab was still selling a second one.
--
-- Owner, 2026-08-25, looking at
-- /dashboard/<event>/studio/papic?tab=cameras :
--   "We only have 1 type of papic service that starts at 50 credits and
--    increases as they increase their payment"
--
-- That is the 2026-08-11 lock, and the catalog already obeys it: the ACTIVE
-- rungs are the credit ladder (100/₱50 · 3,000/₱1,000 · 10,000/₱3,000 ·
-- 20,000/₱5,000) on top of 50 free, and every per-camera price row is
-- is_active = false.
--
-- 🚨 BUT `papic_tier_config` DISAGREED WITH THE CATALOG, AND THE SCREEN READS
-- THE CONFIG. Row `mini` was still is_active = TRUE carrying the display title
-- **"Papic One"** — a name that lock exists to retire — so the cameras tab kept
-- rendering a second, separately-priced Papic product beside the credit ladder:
-- buy this camera, at this rate, for these shots. Two products on one screen,
-- one of which we do not sell.
--
-- 🔑 THE CATALOG BEING RIGHT IS WHY THIS SURVIVED. Every earlier retirement
-- (ltd 20270828150000, unlimited 20270830568357) switched the price row off AND
-- the tier row off. This one switched off half — and the half that decides what
-- the SCREEN shows was the half left on. Same shape as the SKU/rung splits this
-- repo keeps paying for: a retirement takes every copy of the fact, and the
-- copy that renders is the one that matters.
--
-- ⛔ DEACTIVATE, NEVER DROP. `PAPIC_CAMERA_MINI_DAY` is the sku_code every
-- legacy 'mini' seat and the `papic_grant_camera_points()` path still reference;
-- deleting the rung would strand them. The catalog row for it is already
-- is_active = false and is NOT touched here.
--
-- ✅ SAFE BY ARITHMETIC, MEASURED IN PROD 2026-08-25 BEFORE WRITING THIS:
--    papic_one_orders = 0 · papic_guest_orders = 0 · papic_seat_allocations = 0
--    · orders WHERE service_key LIKE 'PAPIC%' = 0.
--    Nobody has ever bought a Papic camera or a Papic credit, so there is no
--    seat to strand and no purchase to honour.
--
-- 🔎 EXACTLY ONE READER of this flag, grepped rather than remembered:
--    app/dashboard/[eventId]/studio/papic/page.tsx — the extra-cameras buy
--    picker, which filters rungs on `papicTierConfig[rung].isActive`. Setting
--    up a dedicated camera does NOT read it (it goes through the point grant),
--    so putting credits aside for one camera's QR is unaffected.

UPDATE public.papic_tier_config
   SET is_active = FALSE,
       -- The title is corrected too, so that a future admin re-activating this
       -- row for a legacy repair cannot resurrect the retired product NAME on a
       -- customer-facing surface. "Papic One" is not a product.
       display_title = 'Dedicated camera (legacy)'
 WHERE tier_code = 'mini';

COMMENT ON TABLE public.papic_tier_config IS
  'Per-camera rung vocabulary. ⚠ HISTORICAL: Papic is ONE product (owner-locked '
  '2026-08-11 · re-stated 2026-08-25) — cameras are FREE and UNLIMITED, and what '
  'a couple buys is CREDITS into one shared pot. Only `free` is active. Every '
  'paid rung here is retired and kept solely so legacy seats and the '
  'papic_grant_camera_points() path keep resolving. Re-activating any paid rung '
  'puts a second Papic product back on the cameras tab.';
