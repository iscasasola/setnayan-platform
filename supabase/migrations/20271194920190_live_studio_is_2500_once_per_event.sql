-- 💰 LIVE STUDIO: ₱1,500/DAY → ₱2,500 ONCE PER EVENT (owner-ruled 2026-09-02, LS6).
--
-- Supersedes the 2026-09-02 ₱1,500/day row (migration 20271192082215) for this SKU
-- only. Owner, verbatim: "live studio is 2500 per event", "unlock once per event,
-- unlimited streams, unlimited video link upload", "i want the mixer and the
-- integration to be one in price".
--
-- THE CATALOG CHANGE ALONE DOES NOT RETIRE THE BROADCAST-DAY MODEL — that is
-- lib/live-studio-window.ts (`decideBroadcastWindow`), shipped in the same PR as
-- this migration. `billing_period` moving to 'one_time' only changes the LABEL
-- (`formatBillingPeriodSuffix` drops the "/ day" suffix); what actually expired
-- multi-cam was `resolveBroadcastWindow`'s clock, and that is retired in code, not
-- here. Shipping one half without the other would have a couple pay "per event" and
-- still lose multicam a day after their first go-live — the page saying one thing
-- while the code did another, on a wedding day.
--
-- 'one_time' is already an allowed billing_period value (CHECK widened by
-- migration 20270331500000 for Patiktok's per-day model; 'one_time' was there from
-- the start), so no constraint change is needed here.
--
-- ⚠ THIS FILE IS NOT THE PRICE. `platform_retail_catalog_v2` is admin-managed and
-- is the only number a customer is ever charged; this migration moves that row and
-- then stops mattering. Never quote ₱2,500 from this comment — read the table.
--
-- Idempotent: re-running sets the same values.

UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 2500,
       billing_period   = 'one_time',
       description      = 'Your celebration, streamed live for everyone who can''t be there. One directed Main Stage plus switchable guest cameras across your angles and venues — cut the Main Stage between them with one tap, or let remote guests pick their own view. One unlock covers the whole event — unlimited streams, unlimited video-link uploads, no day limit. Cameras join as phones via the event QR (no install). Free single-camera livestream stays free.',
       updated_at       = NOW()
 WHERE service_code = 'LIVE_STUDIO';

-- ── LIVE_STUDIO_HOSTED_CHANNEL — the "Setnayan supplies the channel" upsell ─────
--
-- Owner ruling 2026-09-02 (same session): keep it a SEPARATE SKU, not folded into
-- LIVE_STUDIO — a Content ID strike on a pooled Setnayan channel risks OTHER
-- couples' archives on the same channel, which is a safety reason to sell it
-- deliberately rather than bundle it into every sale.
--
-- It was priced ₱1,500/day specifically so the TWO SKUs summed to the owner's
-- stated "₱3,000 TOTAL for the hosted option" (see migration 20271192528988). That
-- relationship breaks the moment LIVE_STUDIO becomes a ₱2,500 one-time unlock, and
-- no new figure for the hosted tier has been given — DO NOT INVENT ONE. Zero
-- orders exist on this SKU (verified live 2026-09-02), so nothing is stranded by
-- turning it off; it is deactivated here rather than repriced, and the LS6
-- handback flags this open question for the owner.
--
-- Idempotent: re-running sets the same value.

UPDATE public.platform_retail_catalog_v2
   SET is_active  = FALSE,
       updated_at = NOW()
 WHERE service_code = 'LIVE_STUDIO_HOSTED_CHANNEL';

-- Informational verification (never fails the migration on re-run).
DO $$
DECLARE v_price numeric; v_period text; v_hosted_active boolean;
BEGIN
  SELECT retail_price_php, billing_period INTO v_price, v_period
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'LIVE_STUDIO';
  SELECT is_active INTO v_hosted_active
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'LIVE_STUDIO_HOSTED_CHANNEL';
  RAISE NOTICE 'LIVE_STUDIO now PHP % billing_period=%; LIVE_STUDIO_HOSTED_CHANNEL is_active=%.',
    v_price, v_period, v_hosted_active;
END $$;
