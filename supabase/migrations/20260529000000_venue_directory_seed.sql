-- ============================================================================
-- 20260529000000_venue_directory_seed.sql
--
-- First-pass venue directory seed (2026-05-21 owner direction). Populates
-- 59 well-known Philippine venues across 9 categories as ADMIN-OWNED
-- UNCLAIMED vendor_profiles (user_id=NULL). The venues appear in the
-- public marketplace immediately (is_published=TRUE, public_visibility=
-- 'coming_soon') so couples can browse + save them from day one. The
-- real venue owners can later claim ownership via the admin-side invite
-- flow shipped in 2026-05-21 (PR #240).
--
-- Categories + counts:
--   Catholic Churches    19
--   INC Chapels           3
--   Mosques               3
--   Christian Churches    3
--   Hotel Ballrooms      14
--   Garden Venues         4
--   Beach/Destination     5
--   Heritage              3
--   Civil Registrars      5
--   Total                59
--
-- Wedding-type compatibility tags (compatible_ceremony_types +
-- compatible_venue_settings) are pre-stamped per category so the
-- "match my wedding" filter at /vendors fires correctly.
--
-- Idempotent via ON CONFLICT (business_slug) DO NOTHING — re-running
-- this migration is a no-op once the seed is in place. Coordinates
-- (hq_latitude/hq_longitude) are left NULL — admins or the eventual
-- claimant fills them in via the edit form, which fires the Nominatim
-- geocoder on save.
--
-- Requires 20260528000000_admin_owned_unclaimed_vendor_profiles.sql
-- (vendor_profiles.user_id must already be nullable).
-- ============================================================================

BEGIN;

INSERT INTO public.vendor_profiles (
  user_id,
  created_by_admin_user_id,
  business_name,
  business_slug,
  tagline,
  services,
  location_city,
  hq_address,
  is_published,
  public_visibility,
  compatible_ceremony_types,
  compatible_venue_settings,
  event_types
) VALUES
  -- ──────────────────────────────────────────────────────────────────
  -- Catholic Churches (19) — compatible_ceremony_types includes 'catholic'
  -- ──────────────────────────────────────────────────────────────────
  (NULL, NULL, 'Manila Cathedral', 'manila-cathedral',
   'The Minor Basilica and Metropolitan Cathedral of the Immaculate Conception.',
   ARRAY['religious_venue', 'venue'], 'Manila',
   'Cabildo St cor Beaterio St, Intramuros, Manila',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Quiapo Church', 'quiapo-church',
   'Minor Basilica of the Black Nazarene — Plaza Miranda, Manila.',
   ARRAY['religious_venue', 'venue'], 'Manila',
   'Plaza Miranda, Quiapo, Manila',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Santo Domingo Church', 'santo-domingo-church',
   'National Shrine of Our Lady of La Naval de Manila.',
   ARRAY['religious_venue', 'venue'], 'Quezon City',
   '537 Quezon Ave, Quezon City',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Sacred Heart Parish Cubao', 'sacred-heart-cubao',
   'Sacred Heart of Jesus Parish — Cubao, Quezon City.',
   ARRAY['religious_venue', 'venue'], 'Quezon City',
   '80 P. Tuazon Blvd, Cubao, Quezon City',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Christ the King Parish', 'christ-the-king-parish',
   'Greenmeadows, Quezon City.',
   ARRAY['religious_venue', 'venue'], 'Quezon City',
   'Greenmeadows Ave, Quezon City',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Mary the Queen Parish', 'mary-the-queen-parish',
   'Greenhills, San Juan.',
   ARRAY['religious_venue', 'venue'], 'San Juan',
   'N. Domingo St, Greenhills, San Juan',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Our Lady of Guadalupe Parish', 'our-lady-of-guadalupe',
   'Bernardo Park, Makati.',
   ARRAY['religious_venue', 'venue'], 'Makati',
   'Bernardo Park, Guadalupe Viejo, Makati',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Santuario de San Jose', 'santuario-de-san-jose',
   'Greenhills, San Juan.',
   ARRAY['religious_venue', 'venue'], 'San Juan',
   'Greenhills East, San Juan',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Mount Carmel Shrine New Manila', 'mt-carmel-shrine-new-manila',
   'National Shrine of Our Lady of Mount Carmel.',
   ARRAY['religious_venue', 'venue'], 'Quezon City',
   '1101 Broadway Ave, New Manila, Quezon City',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'San Agustin Church Intramuros', 'san-agustin-intramuros',
   'UNESCO World Heritage site — oldest stone church in the Philippines.',
   ARRAY['religious_venue', 'venue'], 'Manila',
   'General Luna St, Intramuros, Manila',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Pink Sisters Convent Chapel Tagaytay', 'pink-sisters-tagaytay',
   'Holy Spirit Adoration Sisters chapel in Tagaytay.',
   ARRAY['religious_venue', 'venue'], 'Tagaytay',
   'Tagaytay-Calamba Rd, Tagaytay City',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage', 'destination']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'St. Anthony of Padua Tagaytay', 'st-anthony-tagaytay',
   'Parish Church of St. Anthony of Padua, Tagaytay.',
   ARRAY['religious_venue', 'venue'], 'Tagaytay',
   'Mendez Crossing, Tagaytay City',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage', 'destination']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Our Lady of Manaoag', 'our-lady-of-manaoag',
   'Minor Basilica of Our Lady of the Most Holy Rosary of Manaoag.',
   ARRAY['religious_venue', 'venue'], 'Manaoag',
   'Manaoag, Pangasinan',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage', 'destination']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Caleruega Church', 'caleruega-church',
   'Transfiguration Chapel, Batulao — hilltop garden ceremony venue.',
   ARRAY['religious_venue', 'venue'], 'Nasugbu',
   'Batulao, Nasugbu, Batangas',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage', 'destination', 'garden']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Our Lady of the Mount Chapel Pico de Loro', 'pico-de-loro-chapel',
   'Hamilo Coast hilltop chapel.',
   ARRAY['religious_venue', 'venue'], 'Nasugbu',
   'Hamilo Coast, Nasugbu, Batangas',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['destination', 'beach']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Cebu Metropolitan Cathedral', 'cebu-metropolitan-cathedral',
   'Cathedral of the Archdiocese of Cebu.',
   ARRAY['religious_venue', 'venue'], 'Cebu City',
   'Mabini St, Cebu City',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Basilica Minore del Santo Niño', 'basilica-santo-nino-cebu',
   'Oldest Roman Catholic church in the Philippines.',
   ARRAY['religious_venue', 'venue'], 'Cebu City',
   'Osmeña Blvd, Cebu City',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Jaro Cathedral', 'jaro-cathedral-iloilo',
   'National Shrine of Our Lady of Candles, Jaro, Iloilo.',
   ARRAY['religious_venue', 'venue'], 'Iloilo City',
   'Jaro Plaza, Iloilo City',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'San Pedro Cathedral Davao', 'san-pedro-cathedral-davao',
   'Mother church of the Archdiocese of Davao.',
   ARRAY['religious_venue', 'venue'], 'Davao City',
   'C.M. Recto St, Davao City',
   TRUE, 'coming_soon',
   ARRAY['catholic']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  -- ──────────────────────────────────────────────────────────────────
  -- INC Chapels (3)
  -- ──────────────────────────────────────────────────────────────────
  (NULL, NULL, 'Iglesia Ni Cristo Central Office', 'inc-central-office',
   'Central Office of the Iglesia Ni Cristo, Quezon City.',
   ARRAY['religious_venue', 'venue'], 'Quezon City',
   'Commonwealth Ave, Diliman, Quezon City',
   TRUE, 'coming_soon',
   ARRAY['inc']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Iglesia Ni Cristo Locale Manila', 'inc-locale-manila',
   'INC Locale in Manila.',
   ARRAY['religious_venue', 'venue'], 'Manila',
   'Loyalty St, Sta. Mesa, Manila',
   TRUE, 'coming_soon',
   ARRAY['inc']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Iglesia Ni Cristo Locale Quezon City', 'inc-locale-qc',
   'INC Locale in Quezon City.',
   ARRAY['religious_venue', 'venue'], 'Quezon City',
   'Tatalon, Quezon City',
   TRUE, 'coming_soon',
   ARRAY['inc']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  -- ──────────────────────────────────────────────────────────────────
  -- Mosques (3)
  -- ──────────────────────────────────────────────────────────────────
  (NULL, NULL, 'Manila Golden Mosque', 'manila-golden-mosque',
   'Masjid Al-Dahab — Globo de Oro, Quiapo, Manila.',
   ARRAY['religious_venue', 'venue'], 'Manila',
   'Globo de Oro St, Quiapo, Manila',
   TRUE, 'coming_soon',
   ARRAY['muslim']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Marawi Grand Mosque', 'marawi-grand-mosque',
   'Sultan Haji Hassanal Bolkiah Masjid, Marawi.',
   ARRAY['religious_venue', 'venue'], 'Marawi',
   'Marawi City, Lanao del Sur',
   TRUE, 'coming_soon',
   ARRAY['muslim']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Cotabato Grand Mosque', 'cotabato-grand-mosque',
   'Masjid Pakistan — Cotabato City.',
   ARRAY['religious_venue', 'venue'], 'Cotabato City',
   'Cotabato City, Maguindanao',
   TRUE, 'coming_soon',
   ARRAY['muslim']::text[], ARRAY['heritage']::text[], ARRAY['wedding']::text[]),

  -- ──────────────────────────────────────────────────────────────────
  -- Christian Churches (3)
  -- ──────────────────────────────────────────────────────────────────
  (NULL, NULL, 'Christ''s Commission Fellowship Ortigas', 'ccf-ortigas',
   'CCF main campus — Frontera Verde, Ortigas Center.',
   ARRAY['religious_venue', 'venue'], 'Pasig',
   'Frontera Verde, Ortigas Center, Pasig',
   TRUE, 'coming_soon',
   ARRAY['christian']::text[], ARRAY['banquet_hall']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Victory Christian Fellowship Fort BGC', 'victory-fort-bgc',
   'Victory BGC campus — Bonifacio Global City, Taguig.',
   ARRAY['religious_venue', 'venue'], 'Taguig',
   '32nd St cor 9th Ave, BGC, Taguig',
   TRUE, 'coming_soon',
   ARRAY['christian']::text[], ARRAY['banquet_hall']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Jesus Is Lord Church Main', 'jil-main',
   'JIL Worldwide HQ.',
   ARRAY['religious_venue', 'venue'], 'Bocaue',
   'Bocaue, Bulacan',
   TRUE, 'coming_soon',
   ARRAY['christian']::text[], ARRAY['banquet_hall']::text[], ARRAY['wedding']::text[]),

  -- ──────────────────────────────────────────────────────────────────
  -- Hotel Ballrooms (14) — compatible_venue_settings = ['banquet_hall']
  -- ──────────────────────────────────────────────────────────────────
  (NULL, NULL, 'Manila Marriott Hotel', 'manila-marriott',
   'Grand Ballroom — Resorts World Manila, Newport City.',
   ARRAY['venue'], 'Pasay',
   '10 Newport Blvd, Newport City, Pasay',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['banquet_hall']::text[], ARRAY['wedding', 'debut', 'corporate']::text[]),

  (NULL, NULL, 'Solaire Resort Manila', 'solaire-manila',
   'Forum Ballroom — Entertainment City.',
   ARRAY['venue'], 'Parañaque',
   '1 Aseana Ave, Parañaque',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['banquet_hall']::text[], ARRAY['wedding', 'debut', 'corporate']::text[]),

  (NULL, NULL, 'Conrad Manila', 'conrad-manila',
   'Forbes Ballroom — Mall of Asia Complex.',
   ARRAY['venue'], 'Pasay',
   'Seaside Blvd, Mall of Asia Complex, Pasay',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['banquet_hall']::text[], ARRAY['wedding', 'debut', 'corporate']::text[]),

  (NULL, NULL, 'Shangri-La at the Fort Manila', 'shangri-la-fort',
   'Grand Ballroom — Bonifacio Global City.',
   ARRAY['venue'], 'Taguig',
   '30th St cor 5th Ave, BGC, Taguig',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['banquet_hall']::text[], ARRAY['wedding', 'debut', 'corporate']::text[]),

  (NULL, NULL, 'The Peninsula Manila', 'peninsula-manila',
   'Rigodon Ballroom — Ayala Ave.',
   ARRAY['venue'], 'Makati',
   'Ayala Ave cor Makati Ave, Makati',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['banquet_hall']::text[], ARRAY['wedding', 'debut', 'corporate']::text[]),

  (NULL, NULL, 'The Manila Hotel', 'manila-hotel',
   'Fiesta Pavilion — Rizal Park.',
   ARRAY['venue'], 'Manila',
   '1 Rizal Park, Manila',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['banquet_hall', 'heritage']::text[], ARRAY['wedding', 'debut', 'corporate']::text[]),

  (NULL, NULL, 'Sofitel Philippine Plaza', 'sofitel-philippine-plaza',
   'Grand Plaza Ballroom — CCP Complex.',
   ARRAY['venue'], 'Pasay',
   'CCP Complex, Roxas Blvd, Pasay',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['banquet_hall']::text[], ARRAY['wedding', 'debut', 'corporate']::text[]),

  (NULL, NULL, 'Diamond Hotel Philippines', 'diamond-hotel',
   'Diamond Ballroom — Roxas Blvd.',
   ARRAY['venue'], 'Manila',
   'Roxas Blvd cor Dr. J. Quintos St, Manila',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['banquet_hall']::text[], ARRAY['wedding', 'debut', 'corporate']::text[]),

  (NULL, NULL, 'Tagaytay Marriott Hotel', 'tagaytay-marriott',
   'Grand Ballroom — Tagaytay highlands view.',
   ARRAY['venue'], 'Tagaytay',
   'Aguinaldo Highway, Tagaytay',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['banquet_hall', 'destination']::text[], ARRAY['wedding', 'debut']::text[]),

  (NULL, NULL, 'Taal Vista Hotel', 'taal-vista-hotel',
   'Taal Vista Ballroom — Taal Lake view.',
   ARRAY['venue'], 'Tagaytay',
   'Aguinaldo Highway, Tagaytay',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['banquet_hall', 'destination']::text[], ARRAY['wedding', 'debut']::text[]),

  (NULL, NULL, 'Twin Lakes Hotel', 'twin-lakes-hotel',
   'Tagaytay highlands hotel — Laurel, Batangas.',
   ARRAY['venue'], 'Laurel',
   'Laurel, Batangas',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['banquet_hall', 'destination', 'garden']::text[], ARRAY['wedding', 'debut']::text[]),

  (NULL, NULL, 'Cebu Marriott Hotel', 'cebu-marriott',
   'Marriott Ballroom — Cebu Business Park.',
   ARRAY['venue'], 'Cebu City',
   'Cebu Business Park, Cebu City',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['banquet_hall']::text[], ARRAY['wedding', 'debut', 'corporate']::text[]),

  (NULL, NULL, 'Shangri-La''s Mactan Resort & Spa', 'shangri-la-mactan',
   'Punta Engaño beach resort — Mactan, Cebu.',
   ARRAY['venue'], 'Lapu-Lapu',
   'Punta Engaño Rd, Lapu-Lapu City, Cebu',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['banquet_hall', 'beach', 'destination']::text[], ARRAY['wedding', 'debut']::text[]),

  (NULL, NULL, 'Crimson Resort & Spa Mactan', 'crimson-mactan',
   'Mactan beachfront resort.',
   ARRAY['venue'], 'Lapu-Lapu',
   'Seascapes Resort Town, Lapu-Lapu City, Cebu',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['banquet_hall', 'beach', 'destination']::text[], ARRAY['wedding', 'debut']::text[]),

  -- ──────────────────────────────────────────────────────────────────
  -- Garden Venues (4)
  -- ──────────────────────────────────────────────────────────────────
  (NULL, NULL, 'Antonio''s Tagaytay', 'antonios-tagaytay',
   'Antonio''s Garden — Tagaytay Highlands.',
   ARRAY['venue'], 'Tagaytay',
   'Aguinaldo Highway, Tagaytay',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['garden', 'destination']::text[], ARRAY['wedding', 'debut']::text[]),

  (NULL, NULL, 'Sonya''s Garden', 'sonyas-garden',
   'Bed & breakfast and garden venue — Alfonso, Cavite.',
   ARRAY['venue'], 'Alfonso',
   'Buck Estate, Alfonso, Cavite',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['garden', 'destination']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Hillcreek Gardens Tagaytay', 'hillcreek-gardens-tagaytay',
   'Garden venue with hilltop views.',
   ARRAY['venue'], 'Alfonso',
   'Alfonso, Cavite',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['garden', 'destination']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Glass Garden Pasig', 'glass-garden-pasig',
   'Garden venue under a glass canopy.',
   ARRAY['venue'], 'Pasig',
   'C. Raymundo Ave, Caniogan, Pasig',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['garden']::text[], ARRAY['wedding', 'debut']::text[]),

  -- ──────────────────────────────────────────────────────────────────
  -- Beach / Destination (5)
  -- ──────────────────────────────────────────────────────────────────
  (NULL, NULL, 'Shangri-La Boracay', 'shangri-la-boracay',
   'Boracay beachfront luxury resort.',
   ARRAY['venue'], 'Malay',
   'Barangay Yapak, Boracay, Aklan',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['beach', 'destination']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Henann Regency Boracay', 'henann-regency-boracay',
   'Station 2 beachfront resort.',
   ARRAY['venue'], 'Malay',
   'Station 2, Boracay, Aklan',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['beach', 'destination']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Pico Sands Hotel', 'pico-sands-hotel',
   'Hamilo Coast beachfront — Nasugbu, Batangas.',
   ARRAY['venue'], 'Nasugbu',
   'Hamilo Coast, Nasugbu, Batangas',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['beach', 'destination']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Eskaya Beach Resort & Spa', 'eskaya-bohol',
   'Panglao, Bohol private villa resort.',
   ARRAY['venue'], 'Panglao',
   'Tawala, Panglao, Bohol',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['beach', 'destination']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Anvaya Cove Bataan', 'anvaya-cove-bataan',
   'Beach + nature retreat — Morong, Bataan.',
   ARRAY['venue'], 'Morong',
   'Morong, Bataan',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['beach', 'destination']::text[], ARRAY['wedding']::text[]),

  -- ──────────────────────────────────────────────────────────────────
  -- Heritage (3)
  -- ──────────────────────────────────────────────────────────────────
  (NULL, NULL, 'Las Casas Filipinas de Acuzar', 'las-casas-filipinas',
   'Heritage estate of restored Spanish-era houses, Bagac, Bataan.',
   ARRAY['venue'], 'Bagac',
   'Bagac, Bataan',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['heritage', 'destination']::text[], ARRAY['wedding', 'debut']::text[]),

  (NULL, NULL, 'Hacienda Isabella', 'hacienda-isabella',
   'Hacienda-style country estate, Cavite.',
   ARRAY['venue'], 'Indang',
   'Indang, Cavite',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['heritage', 'garden', 'destination']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Casino Español de Manila', 'casino-espanol-manila',
   'Historic Spanish casino-clubhouse, Taft Ave, Manila.',
   ARRAY['venue'], 'Manila',
   '855 Taft Ave, Ermita, Manila',
   TRUE, 'coming_soon',
   ARRAY['catholic', 'civil', 'christian', 'inc']::text[], ARRAY['heritage', 'banquet_hall']::text[], ARRAY['wedding', 'debut']::text[]),

  -- ──────────────────────────────────────────────────────────────────
  -- Civil Registrars (5) — compatible_ceremony_types = ['civil']
  -- ──────────────────────────────────────────────────────────────────
  (NULL, NULL, 'Manila City Hall', 'manila-city-hall',
   'Office of the Civil Registrar — Manila.',
   ARRAY['venue'], 'Manila',
   'Padre Burgos Ave, Manila',
   TRUE, 'coming_soon',
   ARRAY['civil']::text[], ARRAY['civil_registrar']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Quezon City Hall', 'quezon-city-hall',
   'Office of the Civil Registrar — Quezon City.',
   ARRAY['venue'], 'Quezon City',
   'Elliptical Rd, Diliman, Quezon City',
   TRUE, 'coming_soon',
   ARRAY['civil']::text[], ARRAY['civil_registrar']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Makati City Hall', 'makati-city-hall',
   'Office of the Civil Registrar — Makati.',
   ARRAY['venue'], 'Makati',
   'J.P. Rizal Ext, Makati',
   TRUE, 'coming_soon',
   ARRAY['civil']::text[], ARRAY['civil_registrar']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Cebu City Hall', 'cebu-city-hall',
   'Office of the Civil Registrar — Cebu City.',
   ARRAY['venue'], 'Cebu City',
   'M.C. Briones St, Cebu City',
   TRUE, 'coming_soon',
   ARRAY['civil']::text[], ARRAY['civil_registrar']::text[], ARRAY['wedding']::text[]),

  (NULL, NULL, 'Davao City Hall', 'davao-city-hall',
   'Office of the Civil Registrar — Davao City.',
   ARRAY['venue'], 'Davao City',
   'San Pedro St, Davao City',
   TRUE, 'coming_soon',
   ARRAY['civil']::text[], ARRAY['civil_registrar']::text[], ARRAY['wedding']::text[])

-- The vendor_profiles_business_slug_unique index is partial + expression-based
-- (LOWER(business_slug)), so we can't name it in an ON CONFLICT target. Bare
-- ON CONFLICT DO NOTHING leans on Postgres to match any unique constraint,
-- which is what we want here — re-running the seed should be a no-op.
ON CONFLICT DO NOTHING;

COMMIT;
