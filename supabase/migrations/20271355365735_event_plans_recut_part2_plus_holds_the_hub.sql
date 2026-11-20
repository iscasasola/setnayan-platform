-- event_plans_recut_part2_plus_holds_the_hub
--
-- 🎟 THE 18 NOV EVENT PLAN RE-CUT, PART 2 — the catalogue's numbers (owner 2026-11-18,
-- specs PLAN_RULINGS_2026-11-18.md rulings 34 · 36 · 38):
--
--   · ruling 36: "Event Pro = 3,000 Papic credits · 1 GB upload size · no Setnayan mark ·
--     full-size originals kept 6 months."
--   · ruling 38: "EVENT ULTRA = 6,000 PAPIC CREDITS (owner: "6,000")."
--   · Event Plus unchanged (1,000 credits).
--   · 🏛 20 Nov (owner, DECISION_LOG 2026-11-20 + specs Pricing.md §1.1): "EVENT PLUS = 1,000 PAPIC CREDITS + THE WHOLE
--     EVENT HUB" and "Event Pro ₱5,490 (was ₱5,690)". Patiktok is retired (not sold, in no plan); Ultra stays ₱9,990.
--
-- 1 · `included_papic_credits` — the number `activateEventPlan` (lib/sku-activation.ts) tops a NEW
--     approval up to. It never claws back credits an event already holds; an event approved
--     before this runs keeps what it was granted then.
-- 2 · `fullres_extra_keep_days` for Event Pro = 92: the days ADDED to the standard 92-day hold
--     (FULL_RES_POST_EVENT_GRACE_DAYS) by `papic_events_past_fullres_clock` — 92 + 92 = 184 days ≈
--     6 months, the same way Ultra's 274 makes 12 (20271344860040_event_ultra_plan.sql). The clock
--     reads every paid/fulfilled order's row and a supplier gift's row (20271348181787), so it can
--     only ever KEEP originals longer — nobody loses a day.
-- 0 · Event Pro's price ₱5,690 → ₱5,490 (Pricing.md §1.1, owner 20 Nov). Guarded: it moves only a row still at
--     ₱5,690, so an admin who has since set another price keeps it. Its 10 + 1 gift bundle follows, as 10 × the new
--     row (the bundle rule). Nothing else's price moves.
-- 3 · Description text only — sentences the re-cut made untrue:
--       · COUPLE_WEBSITE_PRO sold "every premium touch on your Event Hub … comes only with this" — the
--         whole Event Hub is Event Plus's since 20 Nov, and Pro is Plus + Setnayan AI.
--         (`says-what-it-includes.test.ts` reads the LATEST migration that sets this description, so
--         this UPDATE is the FIRST `SET description =` in this file.)
--       · EVENT_ULTRA typed "3,500 Papic credits" and named Patiktok — the count is dropped rather
--         than retyped, as 20271345494976 did for Event Plus (the count lives in
--         `included_papic_credits`), and Patiktok is retired.
--       · EVENT_PLUS said "Setnayan AI and Papic credits" — the AI moved to Event Pro for new buyers
--         (part 1, lib/event-plans.ts `EVENT_PLANS_RECUT_AT`), and Plus now holds the whole Event Hub.
--     Each UPDATE matches only the exact stale sentence, so an admin-written description is left alone.
--
-- ⛔ ONE PRICE IS MOVED HERE (step 0) and its bundle follows it, both guarded on the old figure. Idempotent: every UPDATE skips a row already holding
--    its value.
-- 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md).

BEGIN;

-- Catalogue rows are read on every checkout: never wait more than 5 s for a lock (ship-controller review, PR #8004).
SET LOCAL lock_timeout = '5s';

-- ── 3a · Event Pro's description: what the re-cut made untrue (FIRST — see above) ──
-- 💎 Owner 2026-11-19 (4) + 20 Nov: Event Pro is "Everything in Plus · Setnayan AI · no Setnayan mark", and Plus is the
-- whole Event Hub. No number in the text — the credits are the row's own column.
UPDATE public.platform_retail_catalog_v2
SET description =
      'Everything in Event Plus — the whole Event Hub: your own photo or video '
      'behind any scene or the whole page, every part to design and every theme, '
      'the Pro themes for your invite link among them — with '
      'Setnayan AI, which tells you what is '
      'next and flags what is at risk, more Papic credits and 1 GB of uploads, '
      'plus the Setnayan mark taken off everywhere your guests see it: the page, '
      'the printable version, your story and the recap.',
    updated_at = now()
WHERE service_code = 'COUPLE_WEBSITE_PRO'
  AND description =
      'Every premium touch on your Event Hub in one unlock — the cinematic '
      'Save-the-Date reveal, a Save-the-Date video, background music, photos '
      'you add, your own photo or video behind any scene or the whole '
      'page, the Pro themes for your Event Hub and your invite link, your own '
      'fonts and animation, an animated logo, and your logo on every QR code — '
      'plus the Setnayan mark taken off everywhere your guests see it: the page, '
      'the printable version, your story and the recap. The cinematic reveal '
      'comes only with this.';

-- ── 0 · Event Pro ₱5,690 → ₱5,490 (owner 20 Nov), only from the old figure ──
UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 5490,
       updated_at       = now()
 WHERE service_code = 'COUPLE_WEBSITE_PRO'
   AND retail_price_php = 5690;

-- …and its 10 + 1 gift bundle follows (owner 2026-11-17: "10 + 1 price = 10 × catalogue unit price", migration
-- 20271351048946). Computed from Pro's own row, never typed, and only from the old 10 × ₱5,690 — an admin-set bundle
-- price is left alone.
UPDATE public.platform_retail_catalog_v2 AS b
   SET retail_price_php = 10 * pro.retail_price_php,
       updated_at       = now()
  FROM public.platform_retail_catalog_v2 AS pro
 WHERE pro.service_code = 'COUPLE_WEBSITE_PRO'
   AND b.bundle_of_service_code = 'COUPLE_WEBSITE_PRO'
   AND b.retail_price_php = 10 * 5690
   AND pro.retail_price_php = 5490;

-- ── 1 · the included Papic credits (rulings 36 · 38) ─────────────────────────
UPDATE public.platform_retail_catalog_v2
   SET included_papic_credits = 3000,
       updated_at             = now()
 WHERE service_code = 'COUPLE_WEBSITE_PRO'
   AND included_papic_credits IS DISTINCT FROM 3000;

UPDATE public.platform_retail_catalog_v2
   SET included_papic_credits = 6000,
       updated_at             = now()
 WHERE service_code = 'EVENT_ULTRA'
   AND included_papic_credits IS DISTINCT FROM 6000;

-- ── 2 · Event Pro keeps full-size originals 6 months (ruling 36) ─────────────
UPDATE public.platform_retail_catalog_v2
   SET fullres_extra_keep_days = 92,
       updated_at              = now()
 WHERE service_code = 'COUPLE_WEBSITE_PRO'
   AND fullres_extra_keep_days IS DISTINCT FROM 92;

-- ── 2b · Event Pro's supplier-gift price follows ₱5,490 (controller relay on PR #8004, 20 Nov: "Pro gift_price_php
--         = 5490"). It was ₱5,190 against the old ₱5,690 (20271308555594). Guarded: only from that old value, so an
--         admin-set gift price is left alone.
UPDATE public.platform_retail_catalog_v2
   SET gift_price_php = 5490,
       updated_at     = now()
 WHERE service_code = 'COUPLE_WEBSITE_PRO'
   AND gift_price_php = 5190;

-- ── 3b · Event Ultra's and Event Plus's descriptions (no typed count, no Patiktok, no AI on Plus) ──
UPDATE public.platform_retail_catalog_v2
   SET description = 'Everything in Event Pro, plus Live Watch for one day, your full-size photos kept 12 months, canvas prints and the most Papic credits.',
       updated_at  = now()
 WHERE service_code = 'EVENT_ULTRA'
   AND description IN (
     'Everything in Event Pro, plus Live Watch for one day, your full-size photos kept 12 months, canvas prints, Patiktok and 3,500 Papic credits.',
     'Everything in Event Pro, plus Live Watch for one day, your full-size photos kept 12 months, canvas prints, Patiktok and the most Papic credits.');

UPDATE public.platform_retail_catalog_v2
   SET description = 'Papic credits and the whole Event Hub — every theme and every part to design — with a cinematic Save the Date for your event. Upgrade to Event Pro any time and pay only the difference.',
       updated_at  = now()
 WHERE service_code = 'EVENT_PLUS'
   AND description IN (
     'Setnayan AI and Papic credits for your event. Upgrade to Event Pro any time and pay only the difference.',
     'Papic credits, the ready-made Pro themes and a cinematic Save the Date for your event. Upgrade to Event Pro any time and pay only the difference.');

COMMENT ON COLUMN public.platform_retail_catalog_v2.fullres_extra_keep_days IS
  'Extra days an event that holds this product (paid/fulfilled order, or a supplier gift) keeps its full-size Papic originals, ON TOP of the standard 92 days after the event''s last day. Event Pro: 92 (6 months in all, owner 2026-11-18 ruling 36). Event Ultra: 274 (92 + 274 = 366 days ≈ 12 months, owner 2026-11-13). Read by papic_events_past_fullres_clock; can only keep files longer. Admin-managed.';

COMMIT;
