-- 💰 LIVE STUDIO — HOSTED CHANNEL COMES BACK ON SALE AT ₱3,000 PER DAY
--    (owner-ruled 2026-09-03, LS8 · DECISION_LOG row of that date, corpus commit b3c435b).
--
-- LS6 (migration 20271194920190, PR #5134) did not retire this product. It
-- deactivated it for one reason and said so: the SKU had been priced ₱1,500/day
-- specifically so that it and LIVE_STUDIO summed to the owner's stated "₱3,000
-- total for the hosted option", and that pairing broke the moment LIVE_STUDIO
-- became a ₱2,500 one-time unlock. No replacement figure had been given, the
-- session was told not to invent one, and zero orders existed — so it was
-- switched off rather than guessed at. The owner has now given the figure.
--
--   retail_price_php  1500 → 3000
--   billing_period    per_day (UNCHANGED — see below)
--   is_active         FALSE → TRUE
--
-- ═══ 🔑 PER-DAY IS CORRECT EVEN THOUGH `LIVE_STUDIO` IS ONE-TIME ═══════════════
--
-- ⛔ THIS ASYMMETRY IS THE RULING, NOT A LEFTOVER. It will look like an
-- inconsistency to whoever reads these two rows next — one Live Studio SKU
-- billed once per event, its companion billed per day — and the obvious
-- "cleanup" is to make them match. DO NOT. The two SKUs sell two different
-- kinds of thing:
--
--   · `LIVE_STUDIO` unlocks SOFTWARE. Running the multi-camera controller a
--     second time costs Setnayan nothing, so charging a second time for the
--     same event would be charging for nothing. One event, one unlock.
--   · `LIVE_STUDIO_HOSTED_CHANNEL` consumes a SCARCE PHYSICAL RESOURCE.
--     Production holds THREE Setnayan channels, two of them claimable, and one
--     event-day consumes one. There is no fourth channel to sell. Per-day
--     billing is the only thing that stops one couple sitting on inventory that
--     another couple's wedding date needs.
--
-- ⚠ AND IT IS DELIBERATELY EXPENSIVE — ₱3,000/day against a ₱2,500 one-time
-- base, so the OPTIONAL add-on costs more than the product it attaches to. That
-- is intended and is a safety price, not a margin price. A Content ID strike on
-- a pooled Setnayan channel does not land on the buyer: it lands on a channel
-- holding OTHER COUPLES' ARCHIVES, and YouTube removes every video on a channel
-- at three strikes (LS7, PR #5136 — the buyer is told this in
-- `POOL_CHANNEL_SHARED_STRIKE_NOTICE`, and the admin placing the event is told
-- the same sentence from the same constant). This must be sold deliberately.
-- It must never be bundled, discounted into a package, or defaulted on.
--
-- ═══ WHAT ELSE MOVES WITH THIS ROW ════════════════════════════════════════════
--
-- `apps/web/lib/llms-txt-guard-input.ts` carries a hand-typed copy of the
-- catalog and is the reference reality for both llms.txt guards. Its row for
-- this SKU is updated in the SAME commit — `llms-fixture-matches-the-catalog.db.test.ts`
-- ("a row the fixture calls RETIRED is never live in the catalog") fails against
-- the migration replay otherwise. That trap has turned two separate PRs red
-- (2026-09-02, twice); this is the third time it has been paid for.
--
-- Nothing in code needed a price change: `HostedChannelUpsell`
-- (`app/dashboard/[eventId]/studio/live-studio-control/page.tsx`) already reads
-- its figure from this row via `getCustomerSkuPriceLabel`, which filters on
-- `is_active` — which is exactly why the section, and the shared-strike warning
-- inside it, rendered to nobody while this row was FALSE. Its `if (!owns &&
-- !onSale) return null` opens the component. Flipping this boolean is what puts
-- both back on the screen.
--
-- ⚠ THIS FILE IS NOT THE PRICE. `platform_retail_catalog_v2` is admin-managed
-- and is the only number a customer is ever charged; this migration moves that
-- row and then stops mattering. Never quote ₱3,000 from this comment — read the
-- table.
--
-- Idempotent: re-running sets the same values.

UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 3000,
       billing_period   = 'per_day',
       is_active        = TRUE,
       updated_at       = NOW()
 WHERE service_code = 'LIVE_STUDIO_HOSTED_CHANNEL';

-- Informational verification (never fails the migration on re-run).
DO $$
DECLARE v_price numeric; v_period text; v_active boolean;
BEGIN
  SELECT retail_price_php, billing_period, is_active
    INTO v_price, v_period, v_active
    FROM public.platform_retail_catalog_v2
   WHERE service_code = 'LIVE_STUDIO_HOSTED_CHANNEL';
  RAISE NOTICE 'LIVE_STUDIO_HOSTED_CHANNEL now PHP % billing_period=% is_active=%.',
    v_price, v_period, v_active;
END $$;
