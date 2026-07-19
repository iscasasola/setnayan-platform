-- Vendor "recommend to your couples" engine — Phase 1 foundation (INERT).
--
-- An admin-editable map of vendor leaf (canonical_service_taxonomy.tile_id /
-- service_categories tier-2 id) -> recommendable Setnayan SKU
-- (platform_retail_catalog_v2.service_code).
--
-- Governing principle ("recommend only what helps THEM"): a SKU appears for a
-- leaf only when it amplifies that vendor's OWN deliverable. The map is
-- DELIBERATELY SPARSE — most of the ~50 leaves get nothing; that is correct,
-- not incomplete.
--
-- Cannibalization rule: when a SKU could compete with the vendor's own service
-- it is is_opt_in = TRUE (off by default; the vendor must turn it on). Papic is
-- opt-in for capture leaves (photo_video, photo_booth) for exactly this reason.
--
-- Lands inert: nothing reads this table yet (admin surface = Phase 2,
-- vendor-facing panel = Phase 3). Reference data, mirrors the catalog's
-- public-read RLS (writes go through the service-role admin client).

CREATE TABLE IF NOT EXISTS public.vendor_service_recommendations (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tile_id             text NOT NULL REFERENCES public.service_categories(id) ON UPDATE CASCADE ON DELETE CASCADE,
  service_code        text NOT NULL REFERENCES public.platform_retail_catalog_v2(service_code) ON UPDATE CASCADE ON DELETE CASCADE,
  is_opt_in           boolean NOT NULL DEFAULT false,
  priority            integer NOT NULL DEFAULT 100,
  rationale           text,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by_admin_id uuid,
  UNIQUE (tile_id, service_code)
);

COMMENT ON TABLE public.vendor_service_recommendations IS
  'Admin-editable vendor-leaf -> recommendable SKU map. Sparse by design; is_opt_in flags cannibalization-risk SKUs (off by default). Read by the vendor "recommend to your couples" surface (Phase 3).';
COMMENT ON COLUMN public.vendor_service_recommendations.is_opt_in IS
  'TRUE = the recommendation could compete with the vendor''s own service, so it is hidden until the vendor explicitly opts in.';

CREATE INDEX IF NOT EXISTS vendor_service_recommendations_tile_idx
  ON public.vendor_service_recommendations (tile_id) WHERE is_active;

ALTER TABLE public.vendor_service_recommendations ENABLE ROW LEVEL SECURITY;

-- Reference catalog data — public read, mirroring platform_retail_catalog_v2.
-- All writes go through the service-role admin client (no authenticated write policy).
DROP POLICY IF EXISTS vendor_service_recommendations_public_read ON public.vendor_service_recommendations;
CREATE POLICY vendor_service_recommendations_public_read ON public.vendor_service_recommendations
  FOR SELECT TO authenticated, anon USING (true);

-- ---------------------------------------------------------------------------
-- Seed: the refined leaf -> SKU map (idempotent). Lower priority sorts first.
-- ---------------------------------------------------------------------------
INSERT INTO public.vendor_service_recommendations (tile_id, service_code, is_opt_in, priority, rationale) VALUES
  -- photo_video — additive to their own output; Papic is opt-in (reads as competition).
  ('photo_video', 'CAMERA_BRIDGE',               false, 10, 'Feeds their own DSLR into the gallery — a pure extension of their kit'),
  ('photo_video', 'PANOOD_SYSTEM',               false, 20, 'Videographers run the multicam control room'),
  ('photo_video', 'PAPIC_ADDON_STORIES',         false, 30, 'Post-production reels they would otherwise edit by hand'),
  ('photo_video', 'PAPIC_ADDON_THANK_YOU',       false, 40, 'A deliverable they can bundle into their package'),
  ('photo_video', 'ANIMATED_MONOGRAM',           false, 50, 'Unifies the visual identity across their photos and films'),
  ('photo_video', 'LIVE_WALL',                   false, 60, 'Their shots displayed live at the venue'),
  ('photo_video', 'PAPIC_CAMERA_UNLIMITED_DAY',  true,  90, 'Crowd capture — can read as competition; opt-in only'),

  -- coordinator — orchestrates the whole day; a richer day is their reputation.
  ('coordinator', 'PANOOD_SYSTEM',               false, 10, 'A richer day they orchestrate reflects on them'),
  ('coordinator', 'LIVE_WALL',                   false, 20, 'Guest engagement they can program into the reception'),
  ('coordinator', 'PAPIC_CAMERA_UNLIMITED_DAY',  false, 30, 'Candid coverage across rooms they cannot staff'),
  ('coordinator', 'PAKANTA',                     false, 40, 'A signature song moment they can build the program around'),
  ('coordinator', 'COUPLE_WEBSITE_PRO',          false, 50, 'A polished event hub for the guests they manage'),
  ('coordinator', 'ANIMATED_MONOGRAM',           false, 60, 'A cohesive identity across the event they style'),

  -- host_mc — broadcasts and feeds the program they run.
  ('host_mc',     'PANOOD_SYSTEM',               false, 10, 'Broadcasts the program they run to remote guests'),
  ('host_mc',     'LIVE_WALL',                   false, 20, 'Crowd interaction they can drive from the mic'),
  ('host_mc',     'PABATI',                      false, 30, 'Video greetings are their program content'),

  -- dj — livestream + crowd engagement during their set.
  ('dj',          'PANOOD_SYSTEM',               false, 10, 'Streams their set to guests who could not attend'),
  ('dj',          'LIVE_WALL',                   false, 20, 'Dancefloor engagement on the screen'),

  -- musicians who can perform a custom song.
  ('live_band',     'PAKANTA',                   false, 10, 'A custom song they can perform live'),
  ('live_band',     'PANOOD_SYSTEM',             false, 20, 'Broadcasts their performance'),
  ('wedding_singer','PAKANTA',                   false, 10, 'A custom song they can perform live'),
  ('wedding_singer','PANOOD_SYSTEM',             false, 20, 'Broadcasts their performance'),
  ('performers',    'PAKANTA',                   false, 10, 'A custom song they can perform live'),
  ('performers',    'PANOOD_SYSTEM',             false, 20, 'Broadcasts their performance'),

  -- choir / orchestra — broadcast only (won''t perform a custom pop song).
  ('choir',       'PANOOD_SYSTEM',               false, 10, 'Broadcasts their performance to remote guests'),
  ('orchestra',   'PANOOD_SYSTEM',               false, 10, 'Broadcasts their performance to remote guests'),

  -- printing — the strongest fit: these print INTO their product.
  ('printing',    'ANIMATED_MONOGRAM',           false, 10, 'The monogram prints into their invitations'),
  ('printing',    'CUSTOM_QR_GUEST',             false, 20, 'Per-guest QR on the place cards and invites they produce'),
  ('printing',    'STD_PREMIUM_OPENINGS',        false, 30, 'The digital twin of their save-the-date stationery'),
  ('printing',    'COUPLE_WEBSITE_PRO',          false, 40, 'The online companion to their printed suite'),
  ('printing',    'KWENTO',                      false, 50, 'Words-on-a-photo keepsake that extends their stationery'),

  -- led_wall — direct content feed to the wall they install.
  ('led_wall',    'LIVE_BACKGROUND',             false, 10, 'Content for the wall they install'),
  ('led_wall',    'PANOOD_SYSTEM',               false, 20, 'Multicam feed onto their screen'),
  ('led_wall',    'LIVE_WALL',                   false, 30, 'A live photo collage on their wall'),

  -- stylist_decorator — visual identity ties into their styling.
  ('stylist_decorator', 'LIVE_BACKGROUND',       false, 10, 'A motion backdrop is decor they place'),
  ('stylist_decorator', 'ANIMATED_MONOGRAM',     false, 20, 'A monogram for the signage they style'),
  ('stylist_decorator', 'COUPLE_WEBSITE_PRO',    false, 30, 'Carries their visual identity online'),

  -- reception (venue) — house amenity; no capture conflict.
  ('reception',   'PANOOD_SYSTEM',               false, 10, 'A livestream amenity the venue can offer'),
  ('reception',   'LIVE_WALL',                   false, 20, 'A live photo wall as a house feature'),
  ('reception',   'PAPIC_CAMERA_UNLIMITED_DAY',  false, 30, 'Candid capture across the venue they host'),

  -- lights_sound — AV complement to what they already rig.
  ('lights_sound','PANOOD_SYSTEM',               false, 10, 'The streaming layer on top of the AV they rig'),
  ('lights_sound','LIVE_BACKGROUND',             false, 20, 'Screen content for the displays they run'),

  -- souvenir_giveaways — brand on the tokens they produce.
  ('souvenir_giveaways', 'ANIMATED_MONOGRAM',    false, 10, 'The couple''s mark on the tokens they produce'),
  ('souvenir_giveaways', 'KWENTO',               false, 20, 'A keepsake overlay that pairs with their souvenirs'),

  -- photo_booth — Papic/Live Wall overlap the booth; opt-in only.
  ('photo_booth', 'LIVE_WALL',                   true,  90, 'Overlaps the booth value prop — opt-in only')
ON CONFLICT (tile_id, service_code) DO NOTHING;
