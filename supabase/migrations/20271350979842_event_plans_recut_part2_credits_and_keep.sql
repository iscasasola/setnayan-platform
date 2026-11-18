-- event_plans_recut_part2_credits_and_keep
--
-- 🎟 THE 18 NOV EVENT PLAN RE-CUT, PART 2 — the catalogue's numbers (owner 2026-11-18,
-- specs PLAN_RULINGS_2026-11-18.md rulings 34 · 36 · 38):
--
--   · ruling 36: "Event Pro = 3,000 Papic credits · 1 GB upload size · no Setnayan mark ·
--     full-size originals kept 6 months."
--   · ruling 38: "EVENT ULTRA = 6,000 PAPIC CREDITS (owner: "6,000")."
--   · Event Plus unchanged (1,000 credits).
--
-- 1 · `included_papic_credits` — the number `activateEventPlan` (lib/sku-activation.ts) tops a NEW
--     approval up to. It never claws back credits an event already holds; an event approved
--     before this runs keeps what it was granted then.
-- 2 · `fullres_extra_keep_days` for Event Pro = 92: the days ADDED to the standard 92-day hold
--     (FULL_RES_POST_EVENT_GRACE_DAYS) by `papic_events_past_fullres_clock` — 92 + 92 = 184 days ≈
--     6 months, the same way Ultra's 274 makes 12 (20271344860040_event_ultra_plan.sql). The clock
--     reads every paid/fulfilled order's row and a supplier gift's row (20271348181787), so it can
--     only ever KEEP originals longer — nobody loses a day.
-- 3 · Description text only — three sentences that the re-cut made untrue:
--       · COUPLE_WEBSITE_PRO ended "The cinematic reveal comes only with this." — Event Plus carries
--         the Cinematic Reveal openings now (gate 1). The rest of the sentence is kept word for word.
--         (`says-what-it-includes.test.ts` reads the LATEST migration that sets this description, so
--         this UPDATE is the FIRST `SET description =` in this file.)
--       · EVENT_ULTRA typed "3,500 Papic credits" — the count is dropped rather than retyped, as
--         20271345494976 did for Event Plus: the count lives in `included_papic_credits`, and a
--         sentence with no number cannot drift from it again.
--       · EVENT_PLUS said "Setnayan AI and Papic credits" — the AI moved to Event Pro for new buyers
--         (part 1, lib/event-plans.ts `EVENT_PLANS_RECUT_AT`).
--     Each UPDATE matches only the exact stale sentence, so an admin-written description is left alone.
--
-- ⛔ NO PRICE IS WRITTEN HERE. Idempotent: every UPDATE skips a row already holding its value.
-- 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md).

BEGIN;

-- ── 3a · Event Pro's description: the one claim the re-cut made untrue (FIRST — see above) ──
UPDATE public.platform_retail_catalog_v2
SET description =
      'Every premium touch on your Event Hub in one unlock — the cinematic '
      'Save-the-Date reveal, a Save-the-Date video, background music, photos '
      'you add, your own photo or video behind any scene or the whole '
      'page, the Pro themes for your Event Hub and your invite link, your own '
      'fonts and animation, an animated logo, and your logo on every QR code — '
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

-- ── 3b · Event Ultra's and Event Plus's descriptions (no typed count, no AI on Plus) ──
UPDATE public.platform_retail_catalog_v2
   SET description = 'Everything in Event Pro, plus Live Watch for one day, your full-size photos kept 12 months, canvas prints, Patiktok and the most Papic credits.',
       updated_at  = now()
 WHERE service_code = 'EVENT_ULTRA'
   AND description = 'Everything in Event Pro, plus Live Watch for one day, your full-size photos kept 12 months, canvas prints, Patiktok and 3,500 Papic credits.';

UPDATE public.platform_retail_catalog_v2
   SET description = 'Papic credits, the ready-made Pro themes and a cinematic Save the Date for your event. Upgrade to Event Pro any time and pay only the difference.',
       updated_at  = now()
 WHERE service_code = 'EVENT_PLUS'
   AND description = 'Setnayan AI and Papic credits for your event. Upgrade to Event Pro any time and pay only the difference.';

COMMENT ON COLUMN public.platform_retail_catalog_v2.fullres_extra_keep_days IS
  'Extra days an event that holds this product (paid/fulfilled order, or a supplier gift) keeps its full-size Papic originals, ON TOP of the standard 92 days after the event''s last day. Event Pro: 92 (6 months in all, owner 2026-11-18 ruling 36). Event Ultra: 274 (92 + 274 = 366 days ≈ 12 months, owner 2026-11-13). Read by papic_events_past_fullres_clock; can only keep files longer. Admin-managed.';

COMMIT;
