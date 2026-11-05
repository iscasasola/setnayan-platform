-- event_hub_pro_part_by_part
-- Created via `pnpm migration:new`. Data-only and idempotent.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Owner rulings, 2026-10-22 ("yes" / "yes to all", corpus DECISION_LOG row
-- "EVENT HUB PRO, PART BY PART"), on the approved prototype
-- `prototypes/pro_part_by_part_2026-10-22.html`:
--
--   * 11 parts. BIG ₱1,000: Reveal · Background · Photos · Style · Motion.
--     SMALL ₱500: Logo & QR · Music · Prints · Post Event · Your own scenes ·
--     Custom address.
--   * Full Pro (COUPLE_WEBSITE_PRO) stays ₱5,000 and is the only thing that
--     removes the "Powered by Setnayan" footer. Onboarding keeps ONE offer:
--     Full Pro at its onboarding price. Parts appear later, in the Maker.
--   * CAP: everything paid toward an event for parts (at their web value, from
--     the web or the app) counts; when it reaches the Full Pro price the event
--     owns everything, footer included. Per EVENT.
--
-- ── WHAT THIS FILE DOES ─────────────────────────────────────────────────────
-- One catalogue row per part, priced with the owner's numbers. NOTHING ELSE in
-- the product types a price: the parts page, the Apply sheet, the quiet line
-- and the cap all read these rows (apps/web/lib/hub-parts.ts names the codes;
-- apps/web/lib/couple-website-pro.ts reads the prices for the cap).
--
--   · onboarding_price_php stays NULL on every part — sign-up sells Full Pro
--     only (owner: "Onboarding keeps ONE offer").
--   · ON CONFLICT DO NOTHING: an admin who has already edited a row keeps it.
--   · COUPLE_WEBSITE_PRO is NOT touched (its ₱5,000 / ₱3,000 is
--     20271247699024's, and admin-managed after it).
--
-- ⚠ IN PRODUCTION THIS IS A REAL CHANGE. It reaches prod only through
-- `deploy-prod`'s `supabase db push --include-all`. Never apply it by hand.
-- ⛔ Prices are admin-managed after this. Do not re-derive them from here.

INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able, is_active, billing_period, description)
VALUES
  ('COUPLE_HUB_PART_REVEAL', 'Event Hub Pro · Reveal', 1000.00, 0.00, FALSE, TRUE, 'one_time',
   'Cinematic openings and effects, and your own film on the Save-the-Date and at the top of your Event Hub. For this event and everyone on it.'),
  ('COUPLE_HUB_PART_BACKGROUND', 'Event Hub Pro · Background', 1000.00, 0.00, FALSE, TRUE, 'one_time',
   'Your photo or video behind the page or a scene, background effects, the moving RSVP backdrop, and 500 MB of uploads instead of 10 MB.'),
  ('COUPLE_HUB_PART_PHOTOS', 'Event Hub Pro · Photos', 1000.00, 0.00, FALSE, TRUE, 'one_time',
   'The photo gallery, photos and clips inside scenes, Love Story photos and more than five moments, and crop and zoom.'),
  ('COUPLE_HUB_PART_STYLE', 'Event Hub Pro · Style', 1000.00, 0.00, FALSE, TRUE, 'one_time',
   'Pro themes, Candlelight, every part''s font, colour and size, scene looks, decorations, the RSVP line style and the Papic camera look.'),
  ('COUPLE_HUB_PART_MOTION', 'Event Hub Pro · Motion', 1000.00, 0.00, FALSE, TRUE, 'one_time',
   'Part and scene animation, Scrub and Auto-scroll between sections, and the RSVP "when yes" celebration.'),
  ('COUPLE_HUB_PART_LOGO_QR', 'Event Hub Pro · Logo & QR', 500.00, 0.00, FALSE, TRUE, 'one_time',
   'Your logo animated and travelling to the bar, and your logo on every guest QR code with its shape, pattern and colour.'),
  ('COUPLE_HUB_PART_MUSIC', 'Event Hub Pro · Music', 500.00, 0.00, FALSE, TRUE, 'one_time',
   'Your own song on the Event Hub and the Save-the-Date. Setnayan''s songs stay free.'),
  ('COUPLE_HUB_PART_PRINTS', 'Event Hub Pro · Prints', 500.00, 0.00, FALSE, TRUE, 'one_time',
   'Prints in your Event Hub look, Pro-theme print files, and the whole designed set in one download.'),
  ('COUPLE_HUB_PART_POST_EVENT', 'Event Hub Pro · Post Event', 500.00, 0.00, FALSE, TRUE, 'one_time',
   'Post Event presets, scene looks, chapter write-ups, columns and reviews.'),
  ('COUPLE_HUB_PART_OWN_SCENES', 'Event Hub Pro · Your own scenes', 500.00, 0.00, FALSE, TRUE, 'one_time',
   'A scene of your own on the Event Hub, and the venue''s "Our drawing".'),
  ('COUPLE_HUB_PART_ADDRESS', 'Event Hub Pro · Custom address', 500.00, 0.00, FALSE, TRUE, 'one_time',
   'Pick your own setnayan.com address instead of the automatic one made from your names and date. Your old link keeps forwarding.')
ON CONFLICT (service_code) DO NOTHING;

-- ── PROVE IT ─────────────────────────────────────────────────────────────────
-- Every part exists, is on sale, has no sign-up price, and the eleven together
-- cost MORE than Full Pro — otherwise the cap ("₱X more unlocks everything")
-- would never be reachable from the parts and the offer would be a lie.
DO $$
DECLARE
  v_missing integer;
  v_parts   numeric;
  v_full    numeric;
BEGIN
  SELECT 11 - count(*) INTO v_missing
    FROM public.platform_retail_catalog_v2
   WHERE service_code IN (
           'COUPLE_HUB_PART_REVEAL', 'COUPLE_HUB_PART_BACKGROUND', 'COUPLE_HUB_PART_PHOTOS',
           'COUPLE_HUB_PART_STYLE', 'COUPLE_HUB_PART_MOTION', 'COUPLE_HUB_PART_LOGO_QR',
           'COUPLE_HUB_PART_MUSIC', 'COUPLE_HUB_PART_PRINTS', 'COUPLE_HUB_PART_POST_EVENT',
           'COUPLE_HUB_PART_OWN_SCENES', 'COUPLE_HUB_PART_ADDRESS')
     AND is_active
     AND retail_price_php > 0
     AND onboarding_price_php IS NULL;
  IF v_missing <> 0 THEN
    RAISE EXCEPTION 'Event Hub Pro parts: % of 11 rows are missing, off sale, unpriced or carry a sign-up price', v_missing;
  END IF;

  SELECT sum(retail_price_php) INTO v_parts
    FROM public.platform_retail_catalog_v2 WHERE service_code LIKE 'COUPLE_HUB_PART_%';
  SELECT retail_price_php INTO v_full
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'COUPLE_WEBSITE_PRO';
  IF v_full IS NOT NULL AND v_parts <= v_full THEN
    RAISE EXCEPTION 'Event Hub Pro parts sum to % — not above Full Pro %, so the cap could never be reached', v_parts, v_full;
  END IF;
END
$$;
