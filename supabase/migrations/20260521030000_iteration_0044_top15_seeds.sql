-- ============================================================================
-- 20260521030000_iteration_0044_top15_seeds.sql
--
-- Iteration 0044 — Per-Category Vendor Attribute Schemas (top-15 seeds)
-- Spec corpus: 0044_per_category_schemas/0044_per_category_schemas.md
--
-- V1.1 wave PR 3 of 15. Follow-up to the base framework migration
-- (20260521010000). Renamed from 20260521020000 → 20260521030000 to break
-- a timestamp collision with iteration_0009_photo_delivery_sync_mode, which
-- already owned 20260521020000 when PR #167 merged. `supabase db push` keys
-- on the 14-digit prefix, so duplicates crash the push mid-apply (per the
-- migration-timestamp-guard CI rationale).
--
-- Seeds:
--   • 5 shared_attribute_groups — faith_compatibility, dietary_accommodations,
--     geographic_service_areas, pricing_signal, vendor_credentials.
--   • 15 canonical_service_schemas — catering, photography, videography,
--     bridal_gown_custom, band_live_music, host_emcee, wedding_coordination,
--     florals, stylist_decorator, photo_booth, mobile_bar, coffee_booth,
--     officiant_priest_minister, transportation_bridal_car, wedding_cake.
--
-- These 15 cover ~80% of vendor traffic per the spec § "V1.1 launch set"
-- header. The remaining ~100 canonical_services roll out in V1.2+. JSON
-- shapes mirror the spec verbatim (option arrays, required flags, labels,
-- required_if conditions, min values). Filter_facets is stored as a JSONB
-- array of field names; the GIN index on the base table covers it.
--
-- Idempotent — every INSERT uses ON CONFLICT … DO UPDATE so a re-run brings
-- existing rows back in sync with this canonical content rather than
-- silently skipping.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. shared_attribute_groups — 5 groups
-- ----------------------------------------------------------------------------

INSERT INTO public.shared_attribute_groups (group_name, display_name_en, display_name_tl, attributes)
VALUES
  (
    'faith_compatibility',
    'Faith compatibility',
    'Pagkakatugma sa pananampalataya',
    $json$
    {
      "halal_certified":     { "type": "boolean", "label": "Halal-certified (with official certification)" },
      "halal_compatible":    { "type": "boolean", "label": "Halal-compatible (no pork/alcohol, not formally certified)" },
      "inc_friendly":        { "type": "boolean", "label": "INC-friendly (no alcohol anywhere in food/sauces/desserts)" },
      "kosher_certified":    { "type": "boolean", "label": "Kosher-certified" },
      "kosher_compatible":   { "type": "boolean", "label": "Kosher-compatible" },
      "vegetarian_capable":  { "type": "boolean", "label": "Full vegetarian menu available" },
      "vegan_capable":       { "type": "boolean", "label": "Full vegan menu available" },
      "lenten_compliant":    { "type": "boolean", "label": "No-meat Lenten menu (Catholic Lent season)" },
      "allergen_aware":      { "type": "boolean", "label": "Trained in cross-contamination prevention" }
    }
    $json$::jsonb
  ),
  (
    'dietary_accommodations',
    'Dietary accommodations',
    'Mga akomodasyon sa pagkain',
    $json$
    {
      "gluten_free_capable": { "type": "boolean", "label": "Gluten-free capable" },
      "nut_free_capable":    { "type": "boolean", "label": "Nut-free capable" },
      "dairy_free_capable":  { "type": "boolean", "label": "Dairy-free capable" },
      "diabetic_friendly":   { "type": "boolean", "label": "Diabetic-friendly" },
      "keto_capable":        { "type": "boolean", "label": "Keto capable" },
      "low_sodium_capable":  { "type": "boolean", "label": "Low-sodium capable" }
    }
    $json$::jsonb
  ),
  (
    'geographic_service_areas',
    'Service areas',
    'Mga sineserbisyuhang lugar',
    $json$
    {
      "service_regions": {
        "type": "multi_select",
        "label": "Service regions",
        "options": [
          "metro_manila", "rizal", "cavite", "laguna", "batangas", "bulacan",
          "tagaytay", "cebu", "cebu_metro", "mactan",
          "davao", "iloilo", "bacolod", "cagayan_de_oro", "baguio",
          "boracay", "palawan", "el_nido", "siargao", "bohol", "batanes", "vigan",
          "barmm_general", "lanao_del_sur", "maguindanao", "sulu", "tawi_tawi", "basilan",
          "international_destination"
        ]
      },
      "travel_radius_km_from_base":      { "type": "int", "label": "Travel radius from base (km)" },
      "willing_to_travel_destination":   { "type": "boolean", "label": "Willing to travel to destination weddings" },
      "destination_travel_fee_centavos": { "type": "int", "label": "Destination travel fee (PHP centavos)", "required_if": "willing_to_travel_destination=true" }
    }
    $json$::jsonb
  ),
  (
    'pricing_signal',
    'Pricing',
    'Presyo',
    $json$
    {
      "starting_price_centavos":      { "type": "int", "label": "Starting price (PHP centavos)" },
      "typical_range_min_centavos":   { "type": "int", "label": "Typical range — minimum (PHP centavos)" },
      "typical_range_max_centavos":   { "type": "int", "label": "Typical range — maximum (PHP centavos)" },
      "price_model": {
        "type": "enum",
        "label": "Price model",
        "options": ["fixed_per_package", "tiered", "per_hour", "per_pax", "custom_quote_only"]
      },
      "show_prices_publicly": { "type": "boolean", "label": "Show prices publicly", "default": false }
    }
    $json$::jsonb
  ),
  (
    'vendor_credentials',
    'Credentials',
    'Mga kredensyal',
    $json$
    {
      "years_operating":  { "type": "int", "label": "Years operating" },
      "awards_received": {
        "type": "multi_select",
        "label": "Awards received",
        "options": ["PWP", "PEPP", "Junebug", "WPJA", "ISPWP", "BridesPH", "other"]
      },
      "magazine_features": {
        "type": "multi_select",
        "label": "Magazine features",
        "options": ["Wedding_Essentials", "Bride_PH", "Metro_Society", "OneFineDay", "other"]
      },
      "notable_past_clients":      { "type": "text_short", "label": "Notable past clients" },
      "celebrity_weddings_handled": { "type": "boolean", "label": "Celebrity weddings handled" }
    }
    $json$::jsonb
  )
ON CONFLICT (group_name) DO UPDATE
  SET display_name_en = EXCLUDED.display_name_en,
      display_name_tl = EXCLUDED.display_name_tl,
      attributes      = EXCLUDED.attributes,
      updated_at      = NOW();

-- ----------------------------------------------------------------------------
-- 2. canonical_service_schemas — 15 categories (V1.1 launch set)
--
-- Each row references shared_attribute_groups (inserted above) by name. Per
-- spec § "Category-specific attribute schemas (V1.1 launch set)" the fields
-- below mirror the JSON the spec defines for each canonical_service.
-- ----------------------------------------------------------------------------

INSERT INTO public.canonical_service_schemas (
  canonical_service,
  schema_version,
  display_name_en,
  display_name_tl,
  display_name_ceb,
  shared_attribute_groups,
  category_specific_attributes,
  filter_facets,
  required_for_visibility,
  ranking_signal_weights
)
VALUES

  -- 1) catering
  (
    'catering',
    1,
    'Catering',
    'Catering',
    'Catering',
    ARRAY['faith_compatibility', 'dietary_accommodations', 'geographic_service_areas', 'pricing_signal', 'vendor_credentials'],
    $json$
    {
      "cuisine_specialties": {
        "type": "multi_select",
        "label": "Cuisine specialties",
        "options": ["filipino_traditional", "filipino_chinese", "western", "japanese", "korean", "mediterranean", "spanish", "italian", "thai", "indian", "halal_specialty", "fusion"],
        "required": true
      },
      "service_styles": {
        "type": "multi_select",
        "label": "Service styles",
        "options": ["plated", "buffet", "family_style", "cocktail", "live_station_focused", "lechon_focused", "intimate_only"],
        "required": true
      },
      "headcount_range_min":   { "type": "int", "label": "Headcount range — minimum", "required": true },
      "headcount_range_max":   { "type": "int", "label": "Headcount range — maximum", "required": true },
      "tasting_availability":  { "type": "enum", "label": "Tasting availability", "options": ["free_tasting", "paid_tasting", "no_tasting"] },
      "tasting_fee_centavos":  { "type": "int", "label": "Tasting fee (PHP centavos)", "required_if": "tasting_availability=paid_tasting" },
      "equipment_provided": {
        "type": "multi_select",
        "label": "Equipment provided",
        "options": ["chafers", "china", "silverware", "table_linens", "glassware", "napkins"]
      },
      "crew_size_typical":      { "type": "int", "label": "Typical crew size" },
      "setup_hours_required":   { "type": "int", "label": "Setup hours required" },
      "sample_menu_uploads_count": { "type": "int", "min": 1, "label": "Upload at least 1 sample menu PDF/image" },
      "kitchen_facility_type":  { "type": "enum", "label": "Kitchen facility type", "options": ["full_commissary", "shared_kitchen", "off_site_prep_only"] }
    }
    $json$::jsonb,
    $json$["cuisine_specialties", "service_styles", "headcount_range_min", "faith_compatibility", "dietary_accommodations", "starting_price_centavos", "service_regions"]$json$::jsonb,
    $json$
    {
      "minimum_fields":   ["cuisine_specialties", "service_styles", "headcount_range_min", "headcount_range_max", "service_regions"],
      "minimum_uploads":  { "sample_menu": 1, "vendor_logo": 1 },
      "minimum_products": 10
    }
    $json$::jsonb,
    '{}'::jsonb
  ),

  -- 2) photography
  (
    'photography',
    1,
    'Photography',
    'Potograpiya',
    'Photography',
    ARRAY['geographic_service_areas', 'pricing_signal', 'vendor_credentials'],
    $json$
    {
      "edit_aesthetics": {
        "type": "multi_select",
        "label": "Edit aesthetics",
        "options": ["moody", "bright_airy", "fine_art", "documentary", "editorial", "film_emulation", "bw_heavy", "warm_toned", "cool_toned"],
        "required": true
      },
      "shooting_styles": {
        "type": "multi_select",
        "label": "Shooting styles",
        "options": ["photojournalistic", "posed_traditional", "cinematic", "candid", "fashion_inspired"]
      },
      "deliverables": {
        "type": "multi_select",
        "label": "Deliverables",
        "options": ["wedding_day_photos", "pre_nup_photos", "engagement_photos", "drone_footage", "same_day_edit_stills", "album_design", "reels_for_social"]
      },
      "crew_size_typical":          { "type": "int", "label": "Typical crew size" },
      "response_time_sla_hours":    { "type": "int", "label": "Response time SLA (hours)" },
      "past_venues_worked":         { "type": "multi_select_open", "label": "Venues you've shot at (add up to 50)" },
      "sample_portfolio_uploads_count": { "type": "int", "min": 10, "label": "Upload at least 10 portfolio photos" },
      "wedding_count_handled":      { "type": "int", "label": "Wedding count handled" }
    }
    $json$::jsonb,
    $json$["edit_aesthetics", "shooting_styles", "deliverables", "awards_received", "starting_price_centavos", "service_regions", "response_time_sla_hours"]$json$::jsonb,
    $json$
    {
      "minimum_fields":  ["edit_aesthetics", "shooting_styles", "deliverables", "service_regions"],
      "minimum_uploads": { "portfolio_photos": 10, "vendor_logo": 1 }
    }
    $json$::jsonb,
    '{}'::jsonb
  ),

  -- 3) videography
  (
    'videography',
    1,
    'Videography',
    'Videograpiya',
    'Videography',
    ARRAY['geographic_service_areas', 'pricing_signal', 'vendor_credentials'],
    $json$
    {
      "edit_aesthetics": {
        "type": "multi_select",
        "label": "Edit aesthetics",
        "options": ["cinematic_moody", "documentary", "highlight_focused", "long_form_narrative", "music_video_style"]
      },
      "deliverables": {
        "type": "multi_select",
        "label": "Deliverables",
        "options": ["full_film", "highlight_reel", "same_day_edit", "social_reels", "raw_footage", "drone_footage"]
      },
      "sample_reels_count":         { "type": "int", "min": 3, "label": "Upload at least 3 sample reels" },
      "delivery_turnaround_weeks":  { "type": "int", "label": "Delivery turnaround (weeks)" }
    }
    $json$::jsonb,
    $json$["edit_aesthetics", "deliverables", "starting_price_centavos", "service_regions"]$json$::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  ),

  -- 4) bridal_gown_custom
  (
    'bridal_gown_custom',
    1,
    'Bridal gown (custom)',
    'Bridal gown (custom)',
    'Bridal gown (custom)',
    ARRAY['geographic_service_areas', 'pricing_signal', 'vendor_credentials'],
    $json$
    {
      "service_model": {
        "type": "multi_select",
        "label": "Service model",
        "options": ["made_to_measure", "ready_to_wear", "couture_one_of_one", "rental", "alterations_only"],
        "required": true
      },
      "specialty_types": {
        "type": "multi_select",
        "label": "Specialty types",
        "options": ["bridal_gown", "filipiniana_terno", "filipiniana_maria_clara", "filipiniana_balintawak", "bridesmaid", "mother_of_bride", "flower_girl", "junior_bridesmaid", "matrimonial_pair"]
      },
      "silhouettes_offered": {
        "type": "multi_select",
        "label": "Silhouettes offered",
        "options": ["a_line", "ball_gown", "mermaid", "trumpet", "sheath", "tea_length", "fit_and_flare", "empire"]
      },
      "necklines_offered": {
        "type": "multi_select",
        "label": "Necklines offered",
        "options": ["sweetheart", "v_neck", "halter", "illusion", "off_shoulder", "bateau", "queen_anne", "high_neck"]
      },
      "fabric_specialties": {
        "type": "multi_select",
        "label": "Fabric specialties",
        "options": ["silk", "satin", "lace", "tulle", "chiffon", "organza", "brocade", "pina", "jusi", "embroidered", "beaded"]
      },
      "embellishments": {
        "type": "multi_select",
        "label": "Embellishments",
        "options": ["beadwork", "embroidery", "applique", "pearls", "crystal", "3d_florals", "cultural_motifs"]
      },
      "typical_fittings_count":         { "type": "int", "label": "Typical fittings count" },
      "lead_time_months":               { "type": "int", "label": "Lead time (months)" },
      "rush_capacity_weeks":            { "type": "int", "label": "Rush capacity (weeks)" },
      "showroom_locations":             { "type": "multi_select_open", "label": "Showroom locations" },
      "samples_available_for_try_on":   { "type": "boolean", "label": "Samples available for try-on" },
      "willing_to_travel_for_fitting":  { "type": "boolean", "label": "Willing to travel for fitting" },
      "wedding_day_attendant_available": { "type": "boolean", "label": "Wedding-day attendant available" },
      "on_site_alterations_capable":    { "type": "boolean", "label": "On-site alterations capable" },
      "signature_designer_name":        { "type": "text_short", "label": "Signature designer name" }
    }
    $json$::jsonb,
    $json$["service_model", "specialty_types", "silhouettes_offered", "necklines_offered", "fabric_specialties", "starting_price_centavos", "service_regions"]$json$::jsonb,
    $json$
    {
      "minimum_fields":  ["service_model", "specialty_types", "silhouettes_offered", "service_regions"],
      "minimum_uploads": { "portfolio_photos": 15, "vendor_logo": 1 }
    }
    $json$::jsonb,
    '{}'::jsonb
  ),

  -- 5) band_live_music
  (
    'band_live_music',
    1,
    'Band / live music',
    'Banda',
    'Band / live music',
    ARRAY['geographic_service_areas', 'pricing_signal', 'vendor_credentials'],
    $json$
    {
      "ensemble_configurations": {
        "type": "multi_select",
        "label": "Ensemble configurations",
        "options": ["solo_acoustic", "duo", "trio", "quartet", "full_band_5plus", "string_quartet", "brass_ensemble", "kulintang_ensemble", "rondalla_ensemble", "choir"]
      },
      "genres": {
        "type": "multi_select",
        "label": "Genres",
        "options": ["opm", "pop", "jazz", "standards", "acoustic", "rock", "classical", "kundiman", "folk_pinoy", "contemporary_christian", "broadway", "rnb_soul"]
      },
      "ceremony_ready":            { "type": "boolean", "label": "Ceremony-ready" },
      "reception_ready":           { "type": "boolean", "label": "Reception-ready" },
      "accepts_song_requests":     { "type": "enum", "label": "Accepts song requests", "options": ["yes_any", "yes_from_pre_approved_list", "no"] },
      "song_catalog_count":        { "type": "int", "min": 20, "label": "Tag at least 20 songs from your repertoire (see 0045 product catalog)" },
      "instruments_brought":       { "type": "multi_select", "label": "Instruments brought" },
      "sound_system_provided":     { "type": "boolean", "label": "Sound system provided" },
      "religious_repertoire_available": {
        "type": "multi_select",
        "label": "Religious repertoire available",
        "options": ["catholic_liturgical", "inc_acceptable", "christian_worship", "muslim_acceptable", "secular_only"]
      }
    }
    $json$::jsonb,
    $json$["ensemble_configurations", "genres", "ceremony_ready", "reception_ready", "religious_repertoire_available", "starting_price_centavos", "service_regions"]$json$::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  ),

  -- 6) host_emcee
  (
    'host_emcee',
    1,
    'Host / emcee',
    'Host',
    'Host / emcee',
    ARRAY['geographic_service_areas', 'pricing_signal', 'vendor_credentials'],
    $json$
    {
      "languages_offered": {
        "type": "multi_select",
        "label": "Languages offered",
        "options": ["english", "tagalog", "cebuano", "taglish", "ilocano", "kapampangan", "hiligaynon", "bisaya"],
        "required": true
      },
      "style_archetypes": {
        "type": "multi_select",
        "label": "Style archetypes",
        "options": ["comedic", "formal", "warm_sentimental", "energetic_party", "cultural_traditional"]
      },
      "voice_sample_uploads_count": { "type": "int", "min": 1, "label": "Upload at least 1 voice sample (60-sec audio clip)" },
      "format_experience": {
        "type": "multi_select",
        "label": "Format experience",
        "options": ["catholic_wedding", "civil_ceremony", "muslim_wedding", "inc_wedding", "christian_wedding", "garden_wedding", "beach_wedding", "destination_wedding", "multi_day_wedding"]
      },
      "audience_sizes_handled": {
        "type": "multi_select",
        "label": "Audience sizes handled",
        "options": ["intimate_under_50", "standard_50_to_200", "grand_200_to_500", "huge_500_plus"]
      },
      "religious_service_comfort": {
        "type": "multi_select",
        "label": "Religious service comfort",
        "options": ["all_faiths", "catholic_only", "inc_only", "christian_only", "muslim_only", "secular_only"]
      }
    }
    $json$::jsonb,
    $json$["languages_offered", "style_archetypes", "format_experience", "audience_sizes_handled", "religious_service_comfort", "starting_price_centavos", "service_regions"]$json$::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  ),

  -- 7) wedding_coordination
  (
    'wedding_coordination',
    1,
    'Wedding coordination',
    'Coordinator sa kasal',
    'Wedding coordination',
    ARRAY['geographic_service_areas', 'pricing_signal', 'vendor_credentials'],
    $json$
    {
      "coordinator_types": {
        "type": "multi_select",
        "label": "Coordinator types",
        "options": ["day_of_coordinator", "month_of_coordinator", "partial_planner", "full_service_planner", "destination_specialist"]
      },
      "events_per_year_handled": { "type": "int", "label": "Events per year handled" },
      "languages_spoken":        { "type": "multi_select", "label": "Languages spoken" },
      "ceremony_type_comfort": {
        "type": "multi_select",
        "label": "Ceremony type comfort",
        "options": ["catholic", "civil", "inc", "christian", "muslim", "cultural", "mixed"]
      },
      "team_size":               { "type": "int", "label": "Team size" }
    }
    $json$::jsonb,
    $json$["coordinator_types", "ceremony_type_comfort", "starting_price_centavos", "service_regions"]$json$::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  ),

  -- 8) florals
  (
    'florals',
    1,
    'Florals',
    'Bulaklak',
    'Bulak',
    ARRAY['geographic_service_areas', 'pricing_signal', 'vendor_credentials'],
    $json$
    {
      "arrangement_types": {
        "type": "multi_select",
        "label": "Arrangement types",
        "options": ["bridal_bouquet", "bridesmaid_bouquets", "boutonnieres", "ceremony_aisle", "ceremony_arch", "reception_centerpieces", "backdrop_florals", "wearable_florals", "wreath_focal"]
      },
      "flower_specialties": {
        "type": "multi_select",
        "label": "Flower specialties",
        "options": ["roses", "peonies", "hydrangeas", "orchids", "native_pinoy_florals", "sampaguita", "ylang_ylang", "garden_seasonal", "imported_only"]
      },
      "sustainability_practices": {
        "type": "multi_select",
        "label": "Sustainability practices",
        "options": ["locally_sourced", "seasonal_emphasis", "compostable_arrangements", "rental_arch_structures"]
      },
      "willing_to_dye_custom":       { "type": "boolean", "label": "Willing to dye flowers custom" },
      "garden_wedding_specialist":   { "type": "boolean", "label": "Garden-wedding specialist" },
      "beach_wedding_specialist":    { "type": "boolean", "label": "Beach-wedding specialist" }
    }
    $json$::jsonb,
    $json$["arrangement_types", "flower_specialties", "starting_price_centavos", "service_regions"]$json$::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  ),

  -- 9) stylist_decorator
  (
    'stylist_decorator',
    1,
    'Stylist / decorator',
    'Stylist',
    'Stylist / decorator',
    ARRAY['geographic_service_areas', 'pricing_signal', 'vendor_credentials'],
    $json$
    {
      "theme_specialties": {
        "type": "multi_select",
        "label": "Theme specialties",
        "options": ["boho", "modern_minimalist", "traditional_filipino", "garden_organic", "beach_coastal", "rustic", "industrial", "vintage_classic", "fairytale_romantic", "moody_dark", "cultural_specific"]
      },
      "mood_board_uploads_count":  { "type": "int", "min": 5, "label": "Upload at least 5 mood boards" },
      "venue_styling_capable":     { "type": "boolean", "label": "Venue styling capable" },
      "props_inventory_listed":    { "type": "boolean", "label": "Props inventory listed" },
      "rental_options_available":  { "type": "boolean", "label": "Rental options available" }
    }
    $json$::jsonb,
    $json$["theme_specialties", "starting_price_centavos", "service_regions"]$json$::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  ),

  -- 10) photo_booth
  (
    'photo_booth',
    1,
    'Photo booth',
    'Photo booth',
    'Photo booth',
    ARRAY['geographic_service_areas', 'pricing_signal', 'vendor_credentials'],
    $json$
    {
      "booth_types": {
        "type": "multi_select",
        "label": "Booth types",
        "options": ["traditional_photo_booth", "360_booth", "gif_booth", "polaroid_instax", "selfie_magic_mirror", "patiktok_tiktok_booth"]
      },
      "output_options": {
        "type": "multi_select",
        "label": "Output options",
        "options": ["printed_strips", "digital_email", "social_share_link", "physical_album"]
      },
      "footprint_size":       { "type": "enum", "label": "Footprint size", "options": ["mini", "small", "medium", "large"] },
      "power_requirement":    { "type": "enum", "label": "Power requirement", "options": ["battery_capable", "110v_standard", "220v_industrial"] },
      "attendant_included":   { "type": "boolean", "label": "Attendant included" },
      "props_library_size":   { "type": "int", "label": "Props library size" },
      "backdrop_options_count": { "type": "int", "label": "Backdrop options count" },
      "hours_typical":        { "type": "int", "label": "Typical hours" }
    }
    $json$::jsonb,
    $json$["booth_types", "output_options", "footprint_size", "attendant_included", "starting_price_centavos", "service_regions"]$json$::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  ),

  -- 11) mobile_bar
  (
    'mobile_bar',
    1,
    'Mobile bar',
    'Mobile bar',
    'Mobile bar',
    ARRAY['faith_compatibility', 'geographic_service_areas', 'pricing_signal', 'vendor_credentials'],
    $json$
    {
      "bar_types": {
        "type": "multi_select",
        "label": "Bar types",
        "options": ["full_cocktail_bar", "beer_wine_only", "mocktail_only", "coffee_focused", "whiskey_cigar", "specialty_themed"]
      },
      "non_alcoholic_specialist":   { "type": "boolean", "label": "Mocktail-only capable (INC / Muslim wedding-ready)" },
      "drink_menu_count":           { "type": "int", "min": 5, "label": "List at least 5 drinks (see 0045 product catalog)" },
      "attendant_included":         { "type": "boolean", "label": "Attendant included" },
      "hours_typical":              { "type": "int", "label": "Typical hours" },
      "alcohol_licensing_handled":  { "type": "boolean", "label": "Alcohol licensing handled" }
    }
    $json$::jsonb,
    $json$["bar_types", "non_alcoholic_specialist", "faith_compatibility", "starting_price_centavos", "service_regions"]$json$::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  ),

  -- 12) coffee_booth
  (
    'coffee_booth',
    1,
    'Coffee booth',
    'Coffee booth',
    'Coffee booth',
    ARRAY['faith_compatibility', 'dietary_accommodations', 'geographic_service_areas', 'pricing_signal', 'vendor_credentials'],
    $json$
    {
      "milk_options": {
        "type": "multi_select",
        "label": "Milk options",
        "options": ["whole", "skim", "oat", "almond", "soy", "coconut", "lactose_free"]
      },
      "coffee_bean_origin": {
        "type": "multi_select",
        "label": "Coffee bean origin",
        "options": ["single_origin", "blend", "filipino_grown", "imported", "fair_trade"]
      },
      "specialty_drinks_offered_count": { "type": "int", "min": 5, "label": "List at least 5 specialty drinks" },
      "cup_branding_options": {
        "type": "multi_select",
        "label": "Cup branding options",
        "options": ["plain", "couple_monogram", "custom_design", "biodegradable_kraft"]
      },
      "footprint_size":         { "type": "enum", "label": "Footprint size", "options": ["mini", "standard", "grand"] },
      "power_requirement":      { "type": "enum", "label": "Power requirement", "options": ["battery", "110v", "220v"] },
      "water_access_needed":    { "type": "boolean", "label": "Water access needed" },
      "attendant_included":     { "type": "boolean", "label": "Attendant included" },
      "tasting_available_pre_event": { "type": "boolean", "label": "Pre-event tasting available" }
    }
    $json$::jsonb,
    $json$["milk_options", "coffee_bean_origin", "cup_branding_options", "starting_price_centavos", "service_regions"]$json$::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  ),

  -- 13) officiant_priest_minister
  (
    'officiant_priest_minister',
    1,
    'Officiant / priest / minister',
    'Pari / ministro / opisyante',
    'Officiant / priest / minister',
    ARRAY['geographic_service_areas', 'pricing_signal', 'vendor_credentials'],
    $json$
    {
      "officiant_type": {
        "type": "enum",
        "label": "Officiant type",
        "options": ["catholic_priest", "civil_judge", "civil_mayor", "civil_justice_of_peace", "inc_minister", "born_again_pastor", "evangelical_pastor", "muslim_imam", "cultural_elder"],
        "required": true
      },
      "languages_offered": {
        "type": "multi_select",
        "label": "Languages offered",
        "options": ["english", "tagalog", "cebuano", "taglish", "latin_catholic", "arabic_islamic"]
      },
      "destination_travel_available":   { "type": "boolean", "label": "Destination travel available" },
      "pre_marriage_counseling_included": { "type": "boolean", "label": "Pre-marriage counseling included" },
      "documents_handled": {
        "type": "multi_select",
        "label": "Documents handled",
        "options": ["marriage_license_filing", "cenomar_assistance", "civil_registration"]
      }
    }
    $json$::jsonb,
    $json$["officiant_type", "languages_offered", "destination_travel_available", "starting_price_centavos", "service_regions"]$json$::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  ),

  -- 14) transportation_bridal_car
  (
    'transportation_bridal_car',
    1,
    'Transportation — bridal car',
    'Transportasyon — bridal car',
    'Transportation — bridal car',
    ARRAY['geographic_service_areas', 'pricing_signal', 'vendor_credentials'],
    $json$
    {
      "vehicle_types_available": {
        "type": "multi_select",
        "label": "Vehicle types available",
        "options": ["luxury_sedan", "limousine", "vintage_classic", "suv", "van_minivan", "bus_coaster", "carriage_horsedrawn", "motorcycle_escort"]
      },
      "specific_vehicles_listed_count": { "type": "int", "min": 1, "label": "List at least 1 specific vehicle (see 0045 product catalog)" },
      "driver_attire_options": {
        "type": "multi_select",
        "label": "Driver attire options",
        "options": ["uniformed", "formal_suit", "ceremonial_white", "casual"]
      },
      "decoration_included":           { "type": "boolean", "label": "Decoration included" },
      "destination_travel_capable":    { "type": "boolean", "label": "Destination travel capable" }
    }
    $json$::jsonb,
    $json$["vehicle_types_available", "starting_price_centavos", "service_regions"]$json$::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  ),

  -- 15) wedding_cake
  (
    'wedding_cake',
    1,
    'Wedding cake',
    'Wedding cake',
    'Wedding cake',
    ARRAY['faith_compatibility', 'dietary_accommodations', 'geographic_service_areas', 'pricing_signal', 'vendor_credentials'],
    $json$
    {
      "cake_styles": {
        "type": "multi_select",
        "label": "Cake styles",
        "options": ["traditional_tiered", "naked_rustic", "minimalist_modern", "fault_line", "geode", "buttercream_painted", "fondant_sculptural", "cultural_themed", "single_tier_intimate"]
      },
      "flavor_options_count":   { "type": "int", "min": 5, "label": "List at least 5 flavors (see 0045 product catalog)" },
      "alcohol_in_recipes":     { "type": "boolean", "label": "Cakes contain alcohol (rum, bourbon, etc.) — affects INC/Muslim compatibility" },
      "max_tier_count":         { "type": "int", "label": "Maximum tier count" },
      "delivery_included":      { "type": "boolean", "label": "Delivery included" },
      "tasting_availability":   { "type": "enum", "label": "Tasting availability", "options": ["free", "paid", "none"] }
    }
    $json$::jsonb,
    $json$["cake_styles", "faith_compatibility", "alcohol_in_recipes", "max_tier_count", "starting_price_centavos", "service_regions"]$json$::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  )

ON CONFLICT (canonical_service) DO UPDATE
  SET schema_version              = EXCLUDED.schema_version,
      display_name_en              = EXCLUDED.display_name_en,
      display_name_tl              = EXCLUDED.display_name_tl,
      display_name_ceb             = EXCLUDED.display_name_ceb,
      shared_attribute_groups      = EXCLUDED.shared_attribute_groups,
      category_specific_attributes = EXCLUDED.category_specific_attributes,
      filter_facets                = EXCLUDED.filter_facets,
      required_for_visibility      = EXCLUDED.required_for_visibility,
      ranking_signal_weights       = EXCLUDED.ranking_signal_weights,
      updated_at                   = NOW();

COMMIT;
