-- ============================================================================
-- 20260604010000_venue_directory_reception_seed.sql
--
-- Iteration 0050 (Venue Directory · V1 — promoted from V1.2 2026-05-22 evening).
-- Stacks on `20260604000000_venue_directory_reception_support.sql`. Seeds
-- ~50 synthetic Filipino RECEPTION venues across 5 PH wedding regions
-- (Manila / NCR · Tagaytay · Cebu · Davao · Boracay) into the V1
-- venue_directory.
--
-- All rows are marked `is_demo = TRUE` with a single deterministic batch
-- UUID for the V1-promotion seed. Cleanup: 2026-12-01 deadline (public
-- launch); the same cleanup-batch pattern used by /admin/demo-vendors
-- will extend to demo venues post-launch.
--
-- WHAT'S IN THIS SEED
-- -------------------
-- 50 reception venues total, broken down:
--   • Manila / NCR              16  (Pasay · Makati · Taguig · Manila ·
--                                    Mandaluyong · Quezon City · Parañaque)
--   • Tagaytay / nearby Cavite   9
--   • Cebu / Mactan              9
--   • Davao                      6
--   • Boracay                    6
--   • Bohol / Palawan / Bataan   4  (destination resorts adjacent to the
--                                    five-city focus)
--
-- HARD CLEANUP DEADLINE: December 1, 2026 (public launch).
-- Owner is expected to either (a) replace with real signed-up venues via
-- the vendor invite flow + venue claim path (iteration 0050 spec), or
-- (b) clean ALL is_demo=TRUE venues via /admin/demo-vendors regenerate.
--
-- VENUE_TYPE MAPPING (DEPLOYED UI COMPATIBILITY)
-- ----------------------------------------------
-- Agent B's Reception folder + Agent C's `/venue/[slug]` detail page both
-- shipped 2026-05-22 ahead of this seed and recognize only the original 6
-- reception enum values (hotel_ballroom · garden · beach · destination_resort
-- · heritage · outdoor_tent — see `apps/web/lib/venue-recommendations.ts
-- → findReceptionVenuesByVenueSetting + displayVenueType`). To make these
-- 50 venues surface immediately in the deployed UI, the seed writes those
-- 6 existing values per `venue_type`:
--   • Luxury hotel ballrooms     -> 'hotel_ballroom'
--   • Garden estates             -> 'garden'
--   • Beach resorts              -> 'beach'
--   • Heritage haciendas         -> 'heritage'
--   • Multi-tower casino resorts -> 'destination_resort'
--   • Tented / open-field        -> 'outdoor_tent'
--   • Multi-purpose halls        -> 'hotel_ballroom' (banquet alternative)
--   • Antonio's-style restaurant -> 'garden'        (closest match)
--
-- The 6 new enum values added by the schema migration
-- (banquet_hall, garden_estate, beach_resort, heritage_hacienda,
-- restaurant, multi_purpose_hall) stay reserved for V1.x when Agent B/C
-- extend their helpers — at that point the seed can be re-keyed via an
-- UPDATE migration without data loss.
--
-- COMPATIBILITY MAPPING (compatible_venue_settings)
-- -------------------------------------------------
-- Every venue gets `compatible_venue_settings` populated with the matching
-- `venue_setting` enum values so the /vendors Reception folder venue-match
-- filter fires correctly:
--   • Hotel ballroom      -> ['banquet_hall']
--   • Garden estate       -> ['garden', 'outdoor_tent'] OR ['garden']
--   • Beach resort        -> ['beach']
--   • Heritage hacienda   -> ['heritage']
--   • Destination resort  -> ['destination']
--   • Multi-purpose hall  -> ['banquet_hall']  (intentional — couples
--                            filtering banquet_hall see budget alts too)
--
-- `compatible_ceremony_types` is intentionally `'{}'` (empty) for most
-- secular reception venues — they work for any faith. Civil-registrar
-- adjacent venues get `['civil']`; religious-flexible heritage venues
-- get `['catholic', 'civil']`. Religion-match filter at /vendors Reception
-- folder treats an empty array as "compatible with all faiths" so an
-- empty seed value is the right default.
--
-- COORDINATES
-- -----------
-- Approximate coordinates from public mapping data. ~50m drift is fine
-- for the haversine-distance "ceremony venues near reception" pairing.
-- Owner can override individual rows via the admin edit UI (slated for
-- the Agent C venue detail page PR).
--
-- DATA VOLUME WARNING
-- -------------------
-- ~50 INSERTs in one transaction. All idempotent via ON CONFLICT (slug)
-- DO NOTHING so re-running this migration is a no-op.
-- ============================================================================

BEGIN;

-- Seed batch UUID — deterministic so re-runs of this migration don't churn.
-- Matches the 'legacy batch' pattern from 20260603200000.
-- '00000000-0000-0000-0000-000000000050' (50 = iteration 0050).
-- The /admin/demo-vendors cleanup-batch endpoint can list batches by id.

INSERT INTO public.venue_directory
  (slug, name, venue_type, venue_category, location_city, hq_address,
   hq_latitude, hq_longitude, compatible_ceremony_types,
   compatible_venue_settings, capacity_min, capacity_max,
   day_rate_php_min, day_rate_php_max, description, amenities,
   is_bookable_via_setnayan, is_demo, demo_batch_id, source_note)
VALUES

-- ══════════════════════ MANILA / NCR (16 venues) ══════════════════════

  -- Hotel ballrooms — luxury tier
  ('shangri-la-fort-bgc-reception',
   'Shangri-La at the Fort — Grand Ballroom',
   'hotel_ballroom', 'reception', 'Taguig',
   '30th Street, Bonifacio Global City, Taguig',
   14.5494, 121.0508,
   ARRAY[]::TEXT[], ARRAY['banquet_hall']::TEXT[],
   100, 500,
   350000, 800000,
   'BGC''s premier luxury ballroom with floor-to-ceiling windows, modern Filipino-inspired interiors, and a dedicated bridal suite.',
   '["catering_included","valet_parking","bridal_suite","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('fairmont-makati-reception',
   'Fairmont Makati — Ballroom Plaza',
   'hotel_ballroom', 'reception', 'Makati',
   '1 Raffles Drive, Ayala Center, Makati',
   14.5547, 121.0244,
   ARRAY[]::TEXT[], ARRAY['banquet_hall']::TEXT[],
   80, 350,
   280000, 600000,
   'Five-star Makati ballroom with sky-high city views, full in-house catering, and an adjoining banquet kitchen.',
   '["catering_included","valet_parking","bridal_suite","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor","indoor_air_conditioned"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('discovery-suites-ortigas-reception',
   'Discovery Suites Ortigas — Grand Ballroom',
   'hotel_ballroom', 'reception', 'Pasig',
   '25 ADB Avenue, Ortigas Center, Pasig',
   14.5876, 121.0594,
   ARRAY[]::TEXT[], ARRAY['banquet_hall']::TEXT[],
   80, 300,
   180000, 380000,
   'Boutique Ortigas all-suite hotel with two distinct reception spaces and an in-house wedding planner.',
   '["catering_included","valet_parking","bridal_suite","ballroom","accommodation_available","av_equipment","dance_floor","indoor_air_conditioned"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('solaire-resort-manila-reception',
   'Solaire Resort & Casino — Forum Ballroom',
   'destination_resort', 'reception', 'Parañaque',
   '1 Aseana Avenue, Entertainment City, Parañaque',
   14.5358, 120.9836,
   ARRAY[]::TEXT[], ARRAY['banquet_hall','destination']::TEXT[],
   150, 600,
   400000, 950000,
   'Entertainment City landmark with one of NCR''s largest ballrooms, dedicated bridal floor, and waterfront views.',
   '["catering_included","valet_parking","bridal_suite","ocean_view","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('okada-manila-reception',
   'Okada Manila — Pearl Ballroom',
   'destination_resort', 'reception', 'Parañaque',
   'New Seaside Drive, Entertainment City, Parañaque',
   14.5183, 120.9803,
   ARRAY[]::TEXT[], ARRAY['banquet_hall','destination']::TEXT[],
   200, 700,
   500000, 1200000,
   'Japan-flagship integrated resort with multiple ballroom configurations, the Fountain garden ceremony space, and a Filipino-modern banquet menu.',
   '["catering_included","valet_parking","bridal_suite","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor","indoor_air_conditioned"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('conrad-manila-reception',
   'Conrad Manila — Forbes Ballroom',
   'hotel_ballroom', 'reception', 'Pasay',
   'Seaside Boulevard, Mall of Asia Complex, Pasay',
   14.5544, 120.9856,
   ARRAY[]::TEXT[], ARRAY['banquet_hall']::TEXT[],
   120, 450,
   320000, 700000,
   'Modern Manila Bay-side ballroom with curved ceiling architecture, panoramic sunset views, and Conrad-standard catering.',
   '["catering_included","valet_parking","bridal_suite","ocean_view","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('peninsula-manila-reception',
   'The Peninsula Manila — Rigodon Ballroom',
   'heritage', 'combined', 'Makati',
   'Ayala Avenue corner Makati Avenue, Makati',
   14.5587, 121.0234,
   ARRAY['catholic','civil']::TEXT[], ARRAY['banquet_hall','heritage']::TEXT[],
   100, 400,
   400000, 800000,
   'Heritage Makati hotel with the Rigodon Ballroom — a Manila wedding classic since 1976. Chandelier-lit, full silver service, in-house chapel for civil ceremonies.',
   '["catering_included","valet_parking","bridal_suite","heritage_architecture","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('manila-hotel-reception',
   'The Manila Hotel — Fiesta Pavilion',
   'heritage', 'combined', 'Manila',
   'One Rizal Park, Manila',
   14.5897, 120.9722,
   ARRAY['catholic','civil']::TEXT[], ARRAY['banquet_hall','heritage']::TEXT[],
   150, 800,
   300000, 850000,
   '1912 heritage hotel by Rizal Park. The Fiesta Pavilion seats up to 800; the Centennial Hall offers an intimate alternative for Filipino-modern weddings.',
   '["catering_included","valet_parking","bridal_suite","heritage_architecture","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor","outdoor_space"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('sofitel-philippine-plaza-reception',
   'Sofitel Philippine Plaza — Grand Plaza Ballroom',
   'hotel_ballroom', 'reception', 'Pasay',
   'CCP Complex, Roxas Boulevard, Pasay',
   14.5556, 120.9802,
   ARRAY[]::TEXT[], ARRAY['banquet_hall']::TEXT[],
   150, 550,
   350000, 750000,
   'CCP Complex landmark with the Grand Plaza Ballroom — sunset-facing wedding receptions and French-Filipino fusion catering.',
   '["catering_included","valet_parking","bridal_suite","ocean_view","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('diamond-hotel-reception',
   'Diamond Hotel Philippines — Diamond Ballroom',
   'hotel_ballroom', 'reception', 'Manila',
   'Roxas Boulevard corner Dr. J. Quintos Street, Manila',
   14.5749, 120.9839,
   ARRAY[]::TEXT[], ARRAY['banquet_hall']::TEXT[],
   100, 400,
   220000, 480000,
   'Roxas Boulevard hotel with a generous Diamond Ballroom configurable into two halves. Bay-view bridal suite + dedicated wedding coordinator.',
   '["catering_included","valet_parking","bridal_suite","ocean_view","ballroom","accommodation_available","av_equipment","dance_floor","indoor_air_conditioned"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('marriott-manila-reception',
   'Manila Marriott Hotel — Grand Ballroom',
   'hotel_ballroom', 'reception', 'Pasay',
   'Newport Boulevard, Newport City, Pasay',
   14.5208, 121.0156,
   ARRAY[]::TEXT[], ARRAY['banquet_hall']::TEXT[],
   100, 500,
   280000, 600000,
   'Newport City hotel adjacent to NAIA Terminal 3 — convenient for fly-in guests. Grand Ballroom can be partitioned for smaller receptions.',
   '["catering_included","valet_parking","bridal_suite","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor","indoor_air_conditioned"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('edsa-shangri-la-reception',
   'EDSA Shangri-La — Mandaluyong Ballroom',
   'hotel_ballroom', 'reception', 'Mandaluyong',
   '1 Garden Way, Ortigas Center, Mandaluyong',
   14.5867, 121.0581,
   ARRAY[]::TEXT[], ARRAY['banquet_hall']::TEXT[],
   100, 450,
   280000, 620000,
   'Garden-facing ballroom adjacent to Shangri-La Plaza, with a separate Garden venue for outdoor ceremonies.',
   '["catering_included","valet_parking","bridal_suite","garden_view","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor","outdoor_space"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  -- Heritage / Club tier
  ('manila-polo-club-reception',
   'Manila Polo Club — Pavilion',
   'heritage', 'reception', 'Makati',
   'McKinley Road, Forbes Park, Makati',
   14.5567, 121.0322,
   ARRAY[]::TEXT[], ARRAY['banquet_hall','heritage']::TEXT[],
   100, 400,
   180000, 450000,
   'Members-only Forbes Park club with the Pavilion ballroom — open to wedding bookings for member-sponsored events.',
   '["catering_included","valet_parking","bridal_suite","heritage_architecture","ballroom","outdoor_space","parking_50plus","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('rockwell-tent-reception',
   'Rockwell Tent — Outdoor Tent Space',
   'outdoor_tent', 'reception', 'Makati',
   'Rockwell Drive, Rockwell Center, Makati',
   14.5618, 121.0356,
   ARRAY[]::TEXT[], ARRAY['outdoor_tent','banquet_hall']::TEXT[],
   200, 1500,
   200000, 600000,
   'Large weather-protected tent space in Rockwell Center with high-clear-span flexibility. Couples select their own caterer + decorator.',
   '["outdoor_space","valet_parking","parking_50plus","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('glorietta-activity-center-reception',
   'Glorietta Activity Center',
   'hotel_ballroom', 'reception', 'Makati',
   'Ayala Center, Makati',
   14.5511, 121.0289,
   ARRAY[]::TEXT[], ARRAY['banquet_hall']::TEXT[],
   100, 400,
   80000, 250000,
   'Open-air mall activity center for budget-friendly receptions; couples bring full styling and catering.',
   '["parking_50plus","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('city-of-dreams-reception',
   'City of Dreams Manila — Grand Ballroom',
   'destination_resort', 'reception', 'Parañaque',
   'Asean Avenue, Entertainment City, Parañaque',
   14.5275, 120.9853,
   ARRAY[]::TEXT[], ARRAY['banquet_hall','destination']::TEXT[],
   150, 500,
   380000, 850000,
   'Integrated resort ballroom with Manila Bay views, full in-house wedding desk, and accommodation pre-blocks for fly-in guests.',
   '["catering_included","valet_parking","bridal_suite","ocean_view","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

-- ══════════════════════ TAGAYTAY / CAVITE (9 venues) ══════════════════════

  ('tagaytay-highlands-international-golf-club',
   'Tagaytay Highlands International Golf Club — Clubhouse',
   'heritage', 'combined', 'Tagaytay',
   'Calamba Road, Tagaytay',
   14.0903, 120.9445,
   ARRAY['catholic','civil']::TEXT[], ARRAY['heritage','garden','destination']::TEXT[],
   80, 300,
   220000, 500000,
   'Highlands clubhouse with sweeping Taal Lake views, dedicated bridal cottage, and chapel for combined ceremony + reception weddings.',
   '["catering_included","valet_parking","bridal_suite","garden_view","heritage_architecture","ballroom","outdoor_space","accommodation_available","parking_50plus","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('hillcreek-gardens-tagaytay-reception',
   'Hillcreek Gardens Tagaytay',
   'garden', 'combined', 'Tagaytay',
   'Barangay Pulong Saging, Tagaytay',
   14.0961, 120.9067,
   ARRAY['catholic','civil']::TEXT[], ARRAY['garden','outdoor_tent']::TEXT[],
   50, 250,
   120000, 350000,
   'Lush Tagaytay garden estate with multiple ceremony lawns and a covered reception pavilion. Popular for daytime sit-down receptions.',
   '["garden_view","bridal_suite","outdoor_space","parking_50plus","av_equipment","dance_floor","catering_included"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('tagaytay-marriott-reception',
   'Tagaytay Marriott — Grand Ballroom',
   'hotel_ballroom', 'reception', 'Tagaytay',
   'Aguinaldo Highway, Tagaytay',
   14.0786, 120.9619,
   ARRAY[]::TEXT[], ARRAY['banquet_hall','destination']::TEXT[],
   100, 350,
   220000, 480000,
   'Tagaytay-highlands Marriott property with a column-free ballroom and pre-blocked accommodation for the entourage.',
   '["catering_included","valet_parking","bridal_suite","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor","indoor_air_conditioned"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('antonios-tagaytay-reception',
   'Antonio''s — Tagaytay',
   'garden', 'combined', 'Tagaytay',
   'Purok 138, Barangay Neogan, Tagaytay',
   14.0856, 120.9219,
   ARRAY['catholic','civil']::TEXT[], ARRAY['garden']::TEXT[],
   30, 150,
   150000, 400000,
   'Award-winning Tagaytay private-dining destination with garden ceremony space + full-restaurant takeover for intimate weddings.',
   '["catering_included","bridal_suite","garden_view","outdoor_space","parking_50plus","av_equipment"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('taal-vista-hotel-reception',
   'Taal Vista Hotel — Taal Vista Ballroom',
   'hotel_ballroom', 'reception', 'Tagaytay',
   'Aguinaldo Highway, Tagaytay',
   14.0866, 120.9405,
   ARRAY[]::TEXT[], ARRAY['banquet_hall','destination']::TEXT[],
   80, 300,
   180000, 400000,
   'Historic Tagaytay hotel with the Taal Vista Ballroom and the iconic lake-view veranda for cocktails.',
   '["catering_included","valet_parking","bridal_suite","garden_view","heritage_architecture","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('alta-vista-de-tagaytay',
   'Alta Vista de Tagaytay',
   'garden', 'combined', 'Tagaytay',
   'Barangay Iruhin South, Tagaytay',
   14.1097, 120.9388,
   ARRAY['catholic','civil']::TEXT[], ARRAY['garden','heritage']::TEXT[],
   50, 200,
   140000, 320000,
   'Heritage-themed Tagaytay garden estate with multiple terraces, a Mediterranean-styled chapel, and Filipino-modern banquet hall.',
   '["catering_included","garden_view","heritage_architecture","bridal_suite","outdoor_space","parking_50plus","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('mango-farm-tagaytay',
   'Mango Farm Tagaytay',
   'garden', 'combined', 'Tagaytay',
   'Tolentino East, Tagaytay',
   14.1167, 120.9531,
   ARRAY['catholic','civil']::TEXT[], ARRAY['garden','outdoor_tent']::TEXT[],
   30, 150,
   90000, 220000,
   'Rustic mango orchard with tented reception under fruiting trees. Couples bring their own caterer for a flexible budget.',
   '["garden_view","outdoor_space","parking_50plus","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('mountain-estate-tagaytay',
   'Mountain Estate Tagaytay',
   'garden', 'combined', 'Tagaytay',
   'Barangay Tolentino East, Tagaytay',
   14.1142, 120.9489,
   ARRAY['catholic','civil']::TEXT[], ARRAY['garden','outdoor_tent']::TEXT[],
   40, 180,
   100000, 280000,
   'Highlands estate with terraced gardens and a barn-style reception space; popular for boho-themed daytime weddings.',
   '["garden_view","outdoor_space","bridal_suite","parking_50plus","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('caleruega-reception-hall',
   'Caleruega — Reception Hall',
   'heritage', 'combined', 'Nasugbu',
   'Batulao, Nasugbu, Batangas',
   14.1208, 120.7625,
   ARRAY['catholic']::TEXT[], ARRAY['heritage','destination']::TEXT[],
   60, 200,
   80000, 200000,
   'Dominican retreat estate with the Transfiguration Chapel for ceremonies and an attached reception hall surrounded by Batulao mountains.',
   '["heritage_architecture","garden_view","outdoor_space","accommodation_available","parking_50plus","av_equipment"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

-- ══════════════════════ CEBU / MACTAN (9 venues) ══════════════════════

  ('shangri-la-mactan-reception',
   'Shangri-La''s Mactan Resort & Spa — Acacia Ballroom',
   'beach', 'combined', 'Cebu',
   'Punta Engaño Road, Lapu-Lapu City',
   10.3128, 124.0167,
   ARRAY['catholic','christian','civil']::TEXT[], ARRAY['beach','destination']::TEXT[],
   100, 400,
   400000, 900000,
   'Punta Engaño beachfront resort with the Acacia Ballroom + Hidden Beach Cove ceremony venue. Full destination-wedding package available.',
   '["catering_included","valet_parking","bridal_suite","ocean_view","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor","outdoor_space"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('crimson-resort-mactan-reception',
   'Crimson Resort & Spa Mactan — Grand Ballroom',
   'beach', 'combined', 'Cebu',
   'Seascapes Resort Town, Lapu-Lapu City',
   10.3083, 124.0292,
   ARRAY['catholic','christian','civil']::TEXT[], ARRAY['beach','destination']::TEXT[],
   80, 350,
   320000, 700000,
   'Mactan beachfront resort with a column-free ballroom and three separate ceremony settings (chapel, beach, garden).',
   '["catering_included","valet_parking","bridal_suite","ocean_view","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor","outdoor_space"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('radisson-blu-cebu-reception',
   'Radisson Blu Cebu — Grand Ballroom',
   'hotel_ballroom', 'reception', 'Cebu City',
   'Serging Osmeña Boulevard corner Juan Luna Avenue, Mabolo, Cebu City',
   10.3209, 123.9075,
   ARRAY[]::TEXT[], ARRAY['banquet_hall']::TEXT[],
   100, 450,
   220000, 520000,
   'Cebu City downtown hotel with a pillarless Grand Ballroom and pre-blocked rooms for the entourage.',
   '["catering_included","valet_parking","bridal_suite","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor","indoor_air_conditioned"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('marco-polo-plaza-cebu-reception',
   'Marco Polo Plaza Cebu — Grand Ballroom',
   'hotel_ballroom', 'reception', 'Cebu City',
   'Cebu Veterans Drive, Nivel Hills, Cebu City',
   10.3489, 123.8867,
   ARRAY[]::TEXT[], ARRAY['banquet_hall']::TEXT[],
   100, 500,
   200000, 480000,
   'Hilltop Cebu hotel with panoramic city views from the ballroom and outdoor cocktail terrace.',
   '["catering_included","valet_parking","bridal_suite","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor","outdoor_space"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('jpark-island-resort-reception',
   'JPark Island Resort & Waterpark — Ballroom',
   'destination_resort', 'reception', 'Cebu',
   'M.L. Quezon National Highway, Lapu-Lapu City',
   10.2867, 123.9789,
   ARRAY[]::TEXT[], ARRAY['banquet_hall','destination','beach']::TEXT[],
   150, 500,
   250000, 550000,
   'Mactan resort with both a Grand Ballroom and a waterfront garden venue. Popular for destination weddings with family-friendly amenities.',
   '["catering_included","valet_parking","bridal_suite","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor","ocean_view","outdoor_space"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('bluewater-maribago-reception',
   'Bluewater Maribago Beach Resort',
   'beach', 'combined', 'Cebu',
   'Buyong, Maribago, Mactan Island, Lapu-Lapu City',
   10.2725, 123.9722,
   ARRAY['catholic','christian','civil']::TEXT[], ARRAY['beach','destination']::TEXT[],
   80, 250,
   200000, 500000,
   'Mactan beachfront resort with a tropical chapel and beachside reception lawn — Cebu destination-wedding favorite for over two decades.',
   '["bridal_suite","ocean_view","accommodation_available","outdoor_space","parking_50plus","av_equipment","dance_floor","catering_included"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('plantation-bay-mactan',
   'Plantation Bay Resort & Spa',
   'beach', 'combined', 'Cebu',
   'Marigondon, Mactan, Lapu-Lapu City',
   10.2956, 123.9831,
   ARRAY['catholic','christian','civil']::TEXT[], ARRAY['beach','destination','garden']::TEXT[],
   100, 350,
   260000, 600000,
   'Resort built around expansive saltwater lagoons. Wedding garden + lagoon-side chapel + indoor banquet room cover all weather plans.',
   '["bridal_suite","ocean_view","garden_view","accommodation_available","outdoor_space","parking_50plus","av_equipment","dance_floor","catering_included"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('movenpick-cebu-reception',
   'Mövenpick Hotel Mactan Island Cebu — Mactan Ballroom',
   'beach', 'reception', 'Cebu',
   'Punta Engaño Road, Lapu-Lapu City',
   10.3094, 124.0136,
   ARRAY[]::TEXT[], ARRAY['banquet_hall','beach','destination']::TEXT[],
   100, 350,
   240000, 560000,
   'Mactan beachfront hotel with Swiss-modern interiors and an ocean-view ballroom. Cocktail terrace overlooks the bay.',
   '["catering_included","valet_parking","bridal_suite","ocean_view","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('casa-cebuana-iluminada',
   'Casa Cebuana Iluminada',
   'heritage', 'combined', 'Cebu City',
   'Banawa Hills, Cebu City',
   10.3197, 123.8753,
   ARRAY['catholic','civil']::TEXT[], ARRAY['heritage','garden']::TEXT[],
   40, 150,
   120000, 280000,
   'Heritage-themed Cebu hilltop estate with Spanish-Filipino architecture. Garden ceremony space + indoor sit-down for intimate weddings.',
   '["bridal_suite","garden_view","heritage_architecture","outdoor_space","parking_50plus","av_equipment","catering_included"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

-- ══════════════════════ DAVAO (6 venues) ══════════════════════

  ('marco-polo-davao-reception',
   'Marco Polo Davao — Grand Ballroom',
   'hotel_ballroom', 'reception', 'Davao City',
   'C.M. Recto Street, Davao City',
   7.0682, 125.6094,
   ARRAY[]::TEXT[], ARRAY['banquet_hall']::TEXT[],
   100, 400,
   180000, 450000,
   'Davao City''s premier hotel ballroom with full in-house catering and dedicated bridal suite.',
   '["catering_included","valet_parking","bridal_suite","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor","indoor_air_conditioned"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('seda-abreeza-davao-reception',
   'SEDA Abreeza — Mindanao Ballroom',
   'hotel_ballroom', 'reception', 'Davao City',
   'J.P. Laurel Avenue, Davao City',
   7.0856, 125.6128,
   ARRAY[]::TEXT[], ARRAY['banquet_hall']::TEXT[],
   80, 350,
   140000, 320000,
   'Ayala-managed Davao hotel adjacent to Abreeza Mall. Modern Mindanao-themed ballroom with full A/V setup.',
   '["catering_included","valet_parking","bridal_suite","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor","indoor_air_conditioned"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('park-inn-davao-reception',
   'Park Inn by Radisson Davao — Davao Ballroom',
   'hotel_ballroom', 'reception', 'Davao City',
   'Roxas Boulevard, Davao City',
   7.0742, 125.6133,
   ARRAY[]::TEXT[], ARRAY['banquet_hall']::TEXT[],
   80, 280,
   100000, 240000,
   'Mid-tier Davao hotel with a versatile ballroom and exhibition-friendly pre-function space.',
   '["catering_included","valet_parking","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor","indoor_air_conditioned"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('royal-mandaya-hotel-reception',
   'Royal Mandaya Hotel — Grand Ballroom',
   'hotel_ballroom', 'reception', 'Davao City',
   'J. Palma Gil Street, Davao City',
   7.0789, 125.6094,
   ARRAY[]::TEXT[], ARRAY['banquet_hall']::TEXT[],
   100, 350,
   90000, 220000,
   'Long-running Davao hotel with chandelier-lit ballroom. Budget-friendly tier for full-service Davao weddings.',
   '["catering_included","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor","indoor_air_conditioned"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('pearl-farm-beach-resort-samal',
   'Pearl Farm Beach Resort — Samal',
   'beach', 'combined', 'Davao City',
   'Kaputian, Samal Island, Davao del Norte',
   6.8950, 125.7256,
   ARRAY['catholic','civil']::TEXT[], ARRAY['beach','destination']::TEXT[],
   60, 200,
   280000, 600000,
   'Samal Island private-island resort. Combined ceremony + reception on the beach or in the Mandaya pavilion. Boat transfer from Davao City.',
   '["bridal_suite","ocean_view","accommodation_available","outdoor_space","av_equipment","dance_floor","catering_included"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('eden-nature-park-davao',
   'Eden Nature Park & Resort',
   'garden', 'combined', 'Davao City',
   'Brgy. Eden, Toril, Davao City',
   7.0067, 125.4194,
   ARRAY['catholic','civil']::TEXT[], ARRAY['garden','destination']::TEXT[],
   50, 200,
   100000, 280000,
   'Mountain garden resort south of Davao City. Outdoor garden ceremony + indoor banquet under pine trees.',
   '["bridal_suite","garden_view","accommodation_available","outdoor_space","parking_50plus","av_equipment","dance_floor","catering_included"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

-- ══════════════════════ BORACAY (6 venues) ══════════════════════

  ('shangri-la-boracay-reception',
   'Shangri-La''s Boracay Resort & Spa — Punta Bunga',
   'beach', 'combined', 'Boracay',
   'Punta Bunga, Boracay Island, Aklan',
   11.9722, 121.9217,
   ARRAY['catholic','christian','civil']::TEXT[], ARRAY['beach','destination']::TEXT[],
   80, 250,
   400000, 950000,
   'Punta Bunga private cove beachfront resort. Multiple ceremony settings (beach, garden, chapel) + the Punta Bunga ballroom for the reception.',
   '["catering_included","bridal_suite","ocean_view","accommodation_available","outdoor_space","av_equipment","dance_floor","ballroom"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('discovery-shores-boracay-reception',
   'Discovery Shores Boracay',
   'beach', 'combined', 'Boracay',
   'Station 1, Boracay Island, Aklan',
   11.9692, 121.9217,
   ARRAY['catholic','christian','civil']::TEXT[], ARRAY['beach','destination']::TEXT[],
   60, 200,
   320000, 720000,
   'Station 1 White Beach property with a beachfront ceremony deck and indoor function room. Premium Boracay destination weddings.',
   '["catering_included","bridal_suite","ocean_view","accommodation_available","outdoor_space","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('fairways-and-bluewater-boracay',
   'Fairways & Bluewater Boracay — Newcoast',
   'destination_resort', 'combined', 'Boracay',
   'Newcoast Village, Yapak, Boracay Island, Aklan',
   11.9803, 121.9300,
   ARRAY['catholic','christian','civil']::TEXT[], ARRAY['banquet_hall','beach','destination','garden']::TEXT[],
   100, 350,
   240000, 550000,
   'Boracay golf-resort hotel with multiple wedding venues — beachfront, garden, chapel, and the Symphony Ballroom for indoor receptions.',
   '["catering_included","bridal_suite","ocean_view","ballroom","accommodation_available","parking_50plus","av_equipment","dance_floor","outdoor_space"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('crimson-resort-boracay',
   'Crimson Resort & Spa Boracay',
   'beach', 'combined', 'Boracay',
   'Sitio Tambisaan, Manoc-Manoc, Malay, Aklan',
   11.9436, 121.9381,
   ARRAY['catholic','christian','civil']::TEXT[], ARRAY['beach','destination']::TEXT[],
   80, 250,
   300000, 680000,
   'Beachfront resort on the quieter eastern coast of Boracay with private wedding chapel + sandbar receptions.',
   '["catering_included","bridal_suite","ocean_view","accommodation_available","outdoor_space","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('henann-regency-boracay-reception',
   'Henann Regency Resort & Spa — Boracay',
   'beach', 'combined', 'Boracay',
   'Station 2, White Beach, Boracay Island, Aklan',
   11.9613, 121.9244,
   ARRAY['catholic','christian','civil']::TEXT[], ARRAY['beach','destination']::TEXT[],
   100, 350,
   200000, 480000,
   'Station 2 White Beach mid-tier resort with beachfront ceremony space and a Garden Ballroom for indoor reception.',
   '["catering_included","bridal_suite","ocean_view","accommodation_available","outdoor_space","av_equipment","dance_floor","ballroom"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('movenpick-boracay-reception',
   'Mövenpick Resort & Spa Boracay',
   'beach', 'combined', 'Boracay',
   'Punta Bunga, Yapak, Boracay Island, Aklan',
   11.9750, 121.9233,
   ARRAY['catholic','christian','civil']::TEXT[], ARRAY['beach','destination']::TEXT[],
   80, 250,
   280000, 620000,
   'Punta Bunga Cove resort with Swiss-Filipino fusion catering and a beachfront pavilion for ceremony + reception combined events.',
   '["catering_included","bridal_suite","ocean_view","accommodation_available","outdoor_space","av_equipment","dance_floor"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

-- ══════════════════════ BOHOL / PALAWAN / BATAAN (4 venues) ══════════════════════
-- Destination resorts adjacent to the five-city focus, useful for couples
-- considering longer-distance destination weddings.

  ('eskaya-beach-resort-panglao',
   'Eskaya Beach Resort & Spa',
   'beach', 'combined', 'Bohol',
   'Tawala, Panglao Island, Bohol',
   9.6253, 124.3614,
   ARRAY['catholic','christian','civil']::TEXT[], ARRAY['beach','destination']::TEXT[],
   40, 150,
   380000, 850000,
   'Private-villa beach resort on Panglao with a beachfront ceremony deck and intimate villa-takeover receptions.',
   '["bridal_suite","ocean_view","accommodation_available","outdoor_space","av_equipment","dance_floor","catering_included"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('las-casas-filipinas-bataan-reception',
   'Las Casas Filipinas de Acuzar — Reception Plaza',
   'heritage', 'combined', 'Bataan',
   'Brgy. Pag-asa, Bagac, Bataan',
   14.7167, 120.2861,
   ARRAY['catholic','civil']::TEXT[], ARRAY['heritage','destination']::TEXT[],
   60, 250,
   220000, 550000,
   'Heritage village of restored Spanish-era Filipino houses with multiple plaza venues and a chapel — Las Casas weddings are an end-to-end experience.',
   '["bridal_suite","heritage_architecture","accommodation_available","outdoor_space","parking_50plus","av_equipment","dance_floor","catering_included"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('hacienda-isabella-cavite-reception',
   'Hacienda Isabella — Reception Lawn',
   'heritage', 'combined', 'Cavite',
   'Brgy. Daine I, Indang, Cavite',
   14.1933, 120.8956,
   ARRAY['catholic','civil']::TEXT[], ARRAY['heritage','garden','destination']::TEXT[],
   60, 250,
   140000, 320000,
   'Cavite hacienda with a colonial-era mansion, garden ceremony grounds, and chapel. Two-hour drive south of Manila.',
   '["bridal_suite","heritage_architecture","garden_view","outdoor_space","parking_50plus","av_equipment","dance_floor","catering_included"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01'),

  ('pico-de-loro-cove-hamilo',
   'Pico de Loro Cove — Hamilo Coast',
   'beach', 'combined', 'Batangas',
   'Hamilo Coast, Nasugbu, Batangas',
   14.1933, 120.6481,
   ARRAY['catholic','christian','civil']::TEXT[], ARRAY['beach','destination']::TEXT[],
   60, 200,
   200000, 480000,
   'Hamilo Coast beachfront cove with the Pico de Loro Chapel for hilltop ceremonies and a beach pavilion for receptions.',
   '["bridal_suite","ocean_view","accommodation_available","outdoor_space","av_equipment","dance_floor","catering_included"]'::jsonb,
   FALSE, TRUE, '00000000-0000-0000-0000-000000000050'::uuid,
   'Synthetic demo venue · 2026-05-22 V1 scope expansion · cleanup before 2026-12-01')

-- All inserts share the same demo_batch_id so /admin/demo-vendors can list
-- + cleanup this batch as a unit.
ON CONFLICT (slug) DO NOTHING;

COMMIT;
