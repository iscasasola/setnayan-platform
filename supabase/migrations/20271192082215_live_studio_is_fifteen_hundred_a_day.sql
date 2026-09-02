-- 💰 LIVE STUDIO: ₱3,000 → ₱1,500 PER EVENT-DAY (owner-ruled 2026-09-02).
--
-- Supersedes the 2026-08-27 price sheet's ₱3,000 for this SKU only. `billing_period`
-- was ALREADY 'per_day' and does not change: the day is the unit, `foldWindowEnd`
-- already stacks purchased days from the first go-live, and buying early still costs
-- nothing because the window anchors on going live rather than on paying.
--
-- ── WHY 1500 AND NOT 500 ───────────────────────────────────────────────────
-- ₱500/day was the proposal, and its variable cost is comfortably covered — a
-- four-camera eight-hour day relays roughly 17 GB through TURN, about ₱54 at
-- $0.05/GB, and only past Cloudflare's free 1,000 GB. Cost was never the objection.
--
-- PRICE IS A COMMITMENT DEVICE, AND PREPARATION IS WHAT DECIDES WHETHER THE DAY
-- WORKS. The BYO path asks the couple to do real work in advance: activate live
-- streaming on their own channel (YouTube's own ~24-hour wait), create the broadcast,
-- and dry-run it. Someone paying ₱500 for a wedding livestream treats it as low
-- stakes and does none of that — then the morning arrives and it is the highest-stakes
-- thing on the platform, on a date that cannot move. ₱1,500 is enough friction that
-- the buyer prepares, and the whole tick-box + help + dry-run apparatus only pays off
-- if they do.
--
-- It also keeps the planned hosted tier (Setnayan's own channel, "subject to
-- availability") at a credible 2× rather than 6×. At ₱500 a free-from-Google YouTube
-- channel would have been priced at five times the entire multi-camera control room.
--
-- ── STILL WELL UNDER MARKET ────────────────────────────────────────────────
-- Measured live 2026-09-02 at ₱62.4/USD: Switcher Studio (the closest analogue —
-- iPhones as wireless cameras, multicam switching, stream to your own YouTube) is
-- $65/mo ≈ ₱4,060; StreamYard Core $44.99/mo ≈ ₱2,810. A couple needing one day
-- subscribes for one month and cancels, so those ARE the comparables. ₱1,500 is about
-- a third of either — and a tenth of the ₱15,000 a Philippine videographer charges for
-- a single live-feed operator, which is the comparison couples here actually make.
--
-- ⚠ THIS FILE IS NOT THE PRICE. `platform_retail_catalog_v2` is admin-managed and is
-- the only number a customer is ever charged; this migration moves that row and then
-- stops mattering. Never quote ₱1,500 from this comment — read the table.
--
-- Idempotent: re-running sets the same value.

UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 1500,
       updated_at       = NOW()
 WHERE service_code = 'LIVE_STUDIO';

-- ── AND FIX A CONTRADICTION THE ROW HAS CARRIED SINCE IT WAS WRITTEN ───────
-- The description ended "Per event." while `billing_period` on the SAME ROW says
-- 'per_day', and the public /llms.txt line has said "per event-day" all along. One
-- row, two answers to "what am I buying?" — and the customer-facing half was the
-- wrong one. Corrected to match the column and the machinery, which is what actually
-- governs: days fold from the first go-live and extra days can be bought.
--
-- Deliberately says nothing about WHOSE YouTube channel carries the broadcast. The
-- BYO-versus-Setnayan-pool product ruling is still open with the owner, and baking
-- either answer into the sales copy would pre-empt a decision that has not been made.

UPDATE public.platform_retail_catalog_v2
   SET description = replace(
         description,
         'Per event.',
         'Priced per event-day — your day starts when you first go live, not when you pay, and extra days can be added.'
       ),
       updated_at = NOW()
 WHERE service_code = 'LIVE_STUDIO'
   AND description LIKE '%Per event.%';
