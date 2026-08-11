-- ═══════════════════════════════════════════════════════════════════════════
-- PAPIC IS ONE PRODUCT NOW — one ladder, and the host hands the shots out
-- ═══════════════════════════════════════════════════════════════════════════
-- Owner, 2026-08-11: *"instead of having 2 papic services. can we offer just
-- one. and then the host can dedicated a specific number of shots for a
-- specific QR code. and the rest can be distributed to the rest?"*
--
-- SUPERSEDES the two-type model (Pool + One) locked 2026-07-29, and both
-- pricing decisions made EARLIER THE SAME DAY — the nine-rung ladder to 30,000
-- (20271129155172) and Papic One at 150 credits ₱50 (20271129422037). Neither
-- of those ever reached production; they merge in the same deploy as this file
-- and are corrected here rather than force-pushed away, because another session
-- authored them and rewriting its history to tidy a pre-launch catalog is not
-- worth the risk of erasing work.
--
-- ── WHY ONE PRODUCT COSTS NO NEW METERING ────────────────────────────────
-- The two "services" were always one mechanism sold twice. A row in
-- papic_event_point_grants with seat_id NULL is a SHARED shot; the same row
-- with seat_id SET is a shot dedicated to that one camera's QR. The capture
-- gate already spends a camera's dedicated balance FIRST and falls through to
-- the shared pool (papic_reserve_camera_points →
-- papic_reserve_event_points_for_seat, tri-state 1/0/-1). What was missing was
-- never the mechanism — it was a way for the HOST to move a shot from one side
-- to the other after buying it. That move is the sibling migration
-- (20271131476413). This file is only the money.
--
-- ── THE LADDER (owner-locked 2026-08-11, final of four revisions) ─────────
--
--        50 credits    FREE      — armed on every event, added on top of
--                                  anything bought (buy 3,000 → hold 3,050)
--       100 credits    ₱50       ₱0.50/credit   NEW  (PAPIC_GUEST_100)
--     3,000 credits    ₱1,000    ₱0.333/credit  live, untouched
--    10,000 credits    ₱3,000    ₱0.300/credit  live, untouched
--    20,000 credits    ₱5,000    ₱0.250/credit  repriced from ₱6,000
--
-- Value strictly improves at every step and no rung can be beaten by buying a
-- smaller one repeatedly — checked at the bottom of this file, not asserted in
-- a comment, because a ladder with an inversion is a ladder the couple is
-- right to game.
--
-- Every rung is ADDITIVE and REPEATABLE, which is what makes four rungs enough:
-- a couple wanting 6,000 buys the ₱1,000 rung twice for the same ₱2,000 the
-- retired 6K rung charged. Nothing is lost by shortening the list.
--
-- ── WHAT RETIRES, AND WHY NOTHING IS DROPPED ─────────────────────────────
-- Deactivated, never deleted (the standing catalog rule — a retired SKU must
-- still resolve for any order minted before it retired):
--   PAPIC_GUEST_6K                        6,000 ₱2,000  — off the owner's list
--   PAPIC_GUEST_13K/16K/23K/26K/30K       — created minutes earlier by
--                                            20271129155172, never sold,
--                                            superseded before they shipped
--   PAPIC_ONE_150 · PAPIC_ONE_100 · PAPIC_CAMERA_MINI_DAY
--                                         — the One product itself. A dedicated
--                                            camera is no longer something you
--                                            BUY; it is something you MAKE, by
--                                            handing shots to a QR.
--
-- 🔒 PAPIC_CAMERA_MINI_DAY IS STILL LOAD-BEARING AND MUST NOT BE DROPPED.
-- provisionPaidCamerasAdmin stamps it as the sku_code of every 'mini' seat, and
-- papic_grant_camera_points branch (B) resolves the LEGACY multi-camera grant
-- through it. Retiring it as a purchasable RUNG is not the same as removing it,
-- and this migration deliberately does only the former.
--
-- ── FREE GOES FROM 55-SPLIT-FOR-THEM TO 50-THEIRS-TO-SPLIT ────────────────
-- Owner: *"keep it at 50"*. Today an event is armed with 50 shared credits PLUS
-- a fourth camera holding 5 dedicated ones. Under one product that fourth
-- camera has no reason to exist: the three free cameras already draw the shared
-- pool, and the host can now hand any of them a dedicated balance themselves.
-- Setting free_one_camera_points = 0 is the whole change —
-- papic_ensure_free_one_camera already treats <= 0 as "arm nothing", and
-- lib/onboarding/services-step-data.ts already makes the copy follow it (there
-- is a test asserting exactly that).
--
-- ⚠ EXISTING GRANTS ARE LEFT ALONE. The five events already carrying a 5-credit
-- free camera keep it. Clawing back a grant somebody was given, to make a
-- number in the copy tidier, is the wrong trade in both directions: it is a
-- destructive write for a cosmetic reason, and 5 credits on five pre-launch
-- test events is not a discrepancy anyone will ever see.
--
-- ⚠ ORDER MATTERS: papic_pass_tiers.service_code carries a FOREIGN KEY to
-- platform_retail_catalog_v2.service_code, so the CATALOG row must exist before
-- the tier row that points at it. Inserting the tier first fails the whole
-- migration with a 23503 — caught by the PGlite replay, which is the only place
-- this ordering is exercised before a deploy tries it against production.

-- ── 1 · the price of the new entry rung (FIRST — the tier FK points here) ───
--
-- ₱50 for 100 credits. This is the rung that has to be easy to say yes to
-- during onboarding, which is why it is the only one priced above the ₱0.33
-- volume rate: ₱0.50 a credit buys a hundred photos for the price of a coffee,
-- and a couple who wants more steps straight onto the ₱1,000 rung.
--
-- saas_overhead_cost_php is scaled from the 10,000 rung's ₱240 (₱0.024/credit),
-- the largest rung and so the most representative of what bulk storage actually
-- costs us: 100 × 0.024 = 2.40.
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, description,
   is_active, is_token_able, is_pax_priced, billing_period)
VALUES
  ('PAPIC_GUEST_100', 'Papic — add 100 shots', 50, 2.40,
   'About 100 photos, or any mix of photos and videos. Yours to share out '
   || 'across your cameras however you like.',
   TRUE, FALSE, FALSE, 'one_time')
ON CONFLICT (service_code) DO UPDATE
  SET title                  = EXCLUDED.title,
      retail_price_php       = EXCLUDED.retail_price_php,
      saas_overhead_cost_php = EXCLUDED.saas_overhead_cost_php,
      description            = EXCLUDED.description,
      is_active              = EXCLUDED.is_active,
      is_token_able          = EXCLUDED.is_token_able,
      is_pax_priced          = EXCLUDED.is_pax_priced,
      billing_period         = EXCLUDED.billing_period,
      updated_at             = now();

-- ── 2 · the top rung is repriced ₱6,000 → ₱5,000 ───────────────────────────
--
-- 20271129155172 introduced PAPIC_GUEST_20K at ₱6,000 (₱0.30/credit, the flat
-- rate that ladder used throughout). The owner's final ladder puts it at
-- ₱5,000, which is ₱0.25/credit and the first genuine volume discount on the
-- board. Setting retail_price_php explicitly is correct here and is NOT the
-- "a price change is never a side effect" hazard: this migration IS the owner's
-- price decision, and it runs exactly once per database. Later changes are made
-- at /admin/pricing, on a database where this has already run.
UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 5000,
       title            = 'Papic — add 20,000 shots',
       description      = 'About 20,000 photos, or any mix of photos and '
                          || 'videos. Yours to share out across your cameras '
                          || 'however you like.',
       is_active        = TRUE,
       updated_at       = now()
 WHERE service_code = 'PAPIC_GUEST_20K';

-- ── 3 · the two surviving middle rungs get the new wording, not a new price ─
--
-- 3,000 ₱1,000 and 10,000 ₱3,000 are unchanged and deliberately keep their
-- prices untouched. Only the copy moves, because "Papic Pool" is no longer a
-- product name — there is one product, and these are sizes of it.
UPDATE public.platform_retail_catalog_v2
   SET title       = 'Papic — add 3,000 shots',
       description = 'About 3,000 photos, or any mix of photos and videos. '
                     || 'Yours to share out across your cameras however you like.',
       updated_at  = now()
 WHERE service_code = 'PAPIC_GUEST';

UPDATE public.platform_retail_catalog_v2
   SET title       = 'Papic — add 10,000 shots',
       description = 'About 10,000 photos, or any mix of photos and videos. '
                     || 'Yours to share out across your cameras however you like.',
       updated_at  = now()
 WHERE service_code = 'PAPIC_GUEST_10K';

-- ── 4 · the ladder is defined by what IS on it ─────────────────────────────
--
-- DEACTIVATE, NEVER DELETE. Every retired code must still resolve for any order
-- minted before it retired — that is why the activation hooks in
-- lib/sku-activation.ts stay wired even for codes nobody can buy.
--
-- 🔑 STATED AS AN INCLUSION, NOT AN EXCLUSION, and that is the load-bearing
-- choice in this section. The obvious form is "deactivate these six codes" — and
-- it is wrong in the one way that matters: a rung somebody adds LATER is
-- sellable by default, and stays sellable until a human remembers to add it to
-- a list in an old migration. That is exactly how six unfunded rungs nearly went
-- on sale this morning. Naming what SURVIVES makes the ladder closed: anything
-- not on it is off, including things that do not exist yet.
--
-- gitleaks:allow — every quoted string below is a catalog service_code. They are
-- public product identifiers that appear verbatim in platform_retail_catalog_v2
-- and on the pricing page; the generic-api-key rule fires on their shape, not on
-- any secret. .gitleaksignore already carries four fingerprints for this same
-- PAPIC_GUEST_* family. An inline allow is used here instead because a
-- fingerprint pins commit AND line number, so it would go stale the next time
-- anyone edits this file.
UPDATE public.platform_retail_catalog_v2
   SET is_active = FALSE, updated_at = now()
 WHERE (service_code LIKE 'PAPIC\_GUEST%' ESCAPE '\' OR service_code LIKE 'PAPIC\_ONE%' ESCAPE '\'
        OR service_code = 'PAPIC_CAMERA_MINI_DAY')  -- gitleaks:allow
   AND service_code <> ALL (ARRAY[
         'PAPIC_GUEST_100', 'PAPIC_GUEST', 'PAPIC_GUEST_10K', 'PAPIC_GUEST_20K'  -- gitleaks:allow
       ]);

-- ── 5 · the tier rows follow the catalog ───────────────────────────────────
INSERT INTO public.papic_pass_tiers (service_code, points, is_topup, sort_order, is_active)
VALUES ('PAPIC_GUEST_100', 100, FALSE, 5, TRUE)  -- gitleaks:allow
ON CONFLICT (service_code) DO UPDATE
  SET points     = EXCLUDED.points,
      is_topup   = EXCLUDED.is_topup,
      sort_order = EXCLUDED.sort_order,
      is_active  = EXCLUDED.is_active,
      updated_at = now();

-- Same inclusion shape, same reason: the four rungs on the ladder are ON, and
-- every other tier row is OFF whether or not this migration knew it existed.
UPDATE public.papic_pass_tiers
   SET is_active = (service_code = ANY (ARRAY[
         'PAPIC_GUEST_100', 'PAPIC_GUEST', 'PAPIC_GUEST_10K', 'PAPIC_GUEST_20K'  -- gitleaks:allow
       ])),
       updated_at = now();

-- ── 6 · Papic One retires as a purchase ────────────────────────────────────
--
-- EVERY row, not a named list: papic_one_tiers exists only to price the One
-- product, and the One product is gone. Naming codes here would leave a row
-- authored later silently purchasable. The rows stay for the legacy grant path
-- to resolve against (papic_grant_camera_points reads points regardless of
-- is_active — see the assertion in § 8), they just stop being offered.
UPDATE public.papic_one_tiers
   SET is_active = FALSE, updated_at = now()
 WHERE is_active;

-- ── 7 · free is a flat 50 ──────────────────────────────────────────────────
UPDATE public.papic_event_pool_config
   SET free_one_camera_points = 0
 WHERE config_key = 'default';

COMMENT ON COLUMN public.papic_event_pool_config.free_one_camera_points IS
  'Dedicated credits armed on the free One camera at event creation. ZERO since '
  '2026-08-11: Papic is one product, free is a flat 50 shared credits, and the '
  'host hands out dedicated balances themselves (papic_dedicate_shots). '
  'papic_ensure_free_one_camera treats <= 0 as "arm nothing", so this also '
  'stops provisioning the fourth camera the 5 credits existed to fill.';

-- ── 8 · assertions — the ladder is checked, not described ──────────────────
DO $$
DECLARE
  r           RECORD;
  prev_rate   NUMERIC := NULL;
  prev_credit INTEGER := NULL;
  n           INTEGER := 0;
  v_free      INTEGER;
BEGIN
  -- (a) exactly the four rungs the owner named are sellable, at his prices.
  FOR r IN
    SELECT t.service_code, t.points, c.retail_price_php AS php
      FROM public.papic_pass_tiers t
      JOIN public.platform_retail_catalog_v2 c ON c.service_code = t.service_code
     WHERE t.is_active AND c.is_active
     ORDER BY t.points
  LOOP
    n := n + 1;

    -- (b) STRICTLY IMPROVING VALUE. A bigger rung that costs more per credit is
    -- a rung nobody should ever buy, and one we would nonetheless be showing.
    IF prev_rate IS NOT NULL AND (r.php / r.points) >= prev_rate THEN
      RAISE EXCEPTION
        'Papic ladder inversion: % gives %.4f/credit, no better than the % below it (%.4f)',
        r.service_code, (r.php / r.points), prev_credit, prev_rate;
    END IF;

    -- (c) NO RUNG BEATEN BY REPEATING A SMALLER ONE. Buying the rung below N
    -- times must never yield more credits than this rung for the same money —
    -- otherwise the ladder teaches the couple to ignore it.
    IF prev_credit IS NOT NULL
       AND FLOOR(r.php / (SELECT c2.retail_price_php
                            FROM public.platform_retail_catalog_v2 c2
                           WHERE c2.service_code = (SELECT t2.service_code
                                                      FROM public.papic_pass_tiers t2
                                                     WHERE t2.points = prev_credit
                                                       AND t2.is_active
                                                     LIMIT 1)))
           * prev_credit >= r.points THEN
      RAISE EXCEPTION
        'Papic ladder dominated: repeating the %-credit rung beats the %-credit rung for the same money',
        prev_credit, r.points;
    END IF;

    prev_rate   := r.php / r.points;
    prev_credit := r.points;
  END LOOP;

  IF n <> 4 THEN
    RAISE EXCEPTION 'Papic ladder must have exactly 4 sellable rungs (owner 2026-08-11), found %', n;
  END IF;

  -- (d) the One product is genuinely unbuyable — no active tier row anywhere.
  IF EXISTS (SELECT 1 FROM public.papic_one_tiers WHERE is_active) THEN
    RAISE EXCEPTION 'Papic One still has a sellable rung — there is one product now';
  END IF;

  -- (e) …but the legacy grant path can still resolve its points. This is the
  -- half that "deactivate never drop" exists to protect, and asserting it is
  -- the difference between retiring a rung and breaking an old order.
  IF NOT EXISTS (
    SELECT 1 FROM public.papic_one_tiers
     WHERE service_code = 'PAPIC_CAMERA_MINI_DAY' AND points > 0
  ) THEN
    RAISE EXCEPTION
      'PAPIC_CAMERA_MINI_DAY lost its points row — papic_grant_camera_points branch (B) '
      'resolves every legacy multi-camera grant through it';
  END IF;

  -- (f) free is 50 shared and nothing dedicated.
  SELECT free_one_camera_points INTO v_free
    FROM public.papic_event_pool_config WHERE config_key = 'default';
  IF COALESCE(v_free, 0) <> 0 THEN
    RAISE EXCEPTION 'free_one_camera_points must be 0 — free is a flat 50 (owner 2026-08-11), found %', v_free;
  END IF;
END $$;
