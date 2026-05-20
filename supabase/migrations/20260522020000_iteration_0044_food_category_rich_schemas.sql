-- ============================================================================
-- 20260522020000_iteration_0044_food_category_rich_schemas.sql
--
-- Iteration 0044 — Per-category schemas for the V1.1 food + beverage roster
-- (Column 3 of the master taxonomy). 16 canonical_services that landed as
-- minimal seeds in 20260521040000 now gain full
-- category_specific_attributes + filter_facets + required_for_visibility.
--
-- The 4 food categories already on rich schemas from 20260521030000
-- (catering, wedding_cake, mobile_bar, coffee_booth) are NOT touched.
--
-- Categories this migration enriches:
--   Catering tier (V1.1.1):
--     lechonero · live_cooking_station · halal_catering ·
--     mocktail_only_caterer · food_truck · dessert_station · mocktail_bar
--   Stations & Booths (V1.1.6):
--     halo_halo_station · ice_cream_cart · crepe_pancake_station ·
--     cotton_candy_cart · charcuterie_board · mini_lechon_station ·
--     whiskey_cigar_bar · mocktail_booth_mini · tea_bar
--
-- Schemas mirror the existing rich-schema pattern from PR #167
-- (multi_select / enum / int / boolean / multi_select_open types,
-- required + required_if flags, min upload counts, filter_facets array
-- + required_for_visibility block). shared_attribute_groups inheritance
-- is unchanged from 20260521040000 (faith + dietary + geographic +
-- pricing + credentials for food / dietary-relevant; alcohol-adjacent
-- variant for whiskey_cigar_bar + mocktail_*).
--
-- Idempotent — UPDATE statements land on the same final values regardless
-- of prior content; re-running is a no-op once applied.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. lechonero — whole-pig roast specialist (PH-specific)
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "pig_sizes_offered": {
    "type": "multi_select",
    "label": "Pig sizes offered",
    "options": ["small_under_15kg", "medium_15_30kg", "large_30_50kg", "jumbo_50kg_plus"],
    "required": true
  },
  "cooking_methods": {
    "type": "multi_select",
    "label": "Cooking methods",
    "options": ["charcoal_open_pit", "gas_rotisserie", "electric_rotisserie", "traditional_wood_fire"],
    "required": true
  },
  "stuffing_options": {
    "type": "multi_select",
    "label": "Stuffing options",
    "options": ["lemongrass_classic", "tamarind_leaves", "herb_infused", "plain"]
  },
  "sauce_options": {
    "type": "multi_select",
    "label": "Sauce options",
    "options": ["liver_sauce_classic", "mang_tomas", "vinegar_dipping", "soy_garlic_house"]
  },
  "presentation_styles": {
    "type": "multi_select",
    "label": "Presentation styles",
    "options": ["whole_pig_table_display", "pre_carved_buffet", "live_carving_show"]
  },
  "on_site_carving_available": { "type": "boolean", "label": "On-site carving available" },
  "delivery_radius_km":         { "type": "int", "label": "Delivery radius (km)" },
  "advance_booking_days":       { "type": "int", "label": "Advance booking required (days)" },
  "headcount_per_pig_size":     { "type": "text_short", "label": "Headcount estimate per pig size (free-form notes)" },
  "sample_photos_uploads_count": { "type": "int", "min": 3, "label": "Upload at least 3 portfolio photos" }
}
$json$::jsonb,
    filter_facets = $json$["pig_sizes_offered", "cooking_methods", "on_site_carving_available", "presentation_styles", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["pig_sizes_offered", "cooking_methods", "service_regions"],
  "minimum_uploads": { "portfolio_photos": 3, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'lechonero';

-- ----------------------------------------------------------------------------
-- 2. live_cooking_station — paella, sushi, grill stations, etc.
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "station_types": {
    "type": "multi_select",
    "label": "Station types",
    "options": ["paella", "sushi", "ramen", "grill_bbq", "pasta", "stir_fry_wok", "dimsum", "taco_bar", "carving_station", "salad_assembly"],
    "required": true
  },
  "chef_demonstration_style": {
    "type": "enum",
    "label": "Chef demonstration style",
    "options": ["interactive_live", "behind_counter", "station_only_no_chef"]
  },
  "power_requirement": {
    "type": "enum",
    "label": "Power requirement",
    "options": ["110v_standard", "220v_industrial", "gas_required", "no_power_needed"]
  },
  "food_prep_location": {
    "type": "enum",
    "label": "Food prep location",
    "options": ["on_site_only", "off_site_prep_finish_on_site", "mixed"]
  },
  "headcount_capacity":          { "type": "int", "label": "Headcount capacity per hour" },
  "setup_footprint_sqm":         { "type": "int", "label": "Setup footprint (sqm)" },
  "attendant_chef_included":     { "type": "boolean", "label": "Chef / attendant included" },
  "hours_typical":               { "type": "int", "label": "Typical service hours" },
  "sample_dishes_uploads_count": { "type": "int", "min": 3, "label": "Upload at least 3 sample dish photos" }
}
$json$::jsonb,
    filter_facets = $json$["station_types", "chef_demonstration_style", "faith_compatibility", "dietary_accommodations", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["station_types", "headcount_capacity", "service_regions"],
  "minimum_uploads": { "sample_dishes": 3, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'live_cooking_station';

-- ----------------------------------------------------------------------------
-- 3. halal_catering — Muslim-faith-gated catering specialists
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "halal_certification_body": {
    "type": "enum",
    "label": "Halal certification body",
    "options": ["islamic_dawah_council_phl", "philippine_halal_authority", "jakim_malaysia", "ifrc_international", "other_certified", "halal_compatible_uncertified"],
    "required": true
  },
  "cuisine_specialties": {
    "type": "multi_select",
    "label": "Cuisine specialties",
    "options": ["filipino_muslim_classic", "middle_eastern", "malay", "indonesian", "indian_halal", "fusion_halal"],
    "required": true
  },
  "halal_kitchen_segregation": {
    "type": "enum",
    "label": "Halal kitchen segregation",
    "options": ["dedicated_halal_kitchen", "segregated_prep_areas", "certified_off_site_only"]
  },
  "haram_avoidance_practices": {
    "type": "multi_select",
    "label": "Haram-avoidance practices",
    "options": ["no_pork_anywhere", "no_alcohol_in_recipes", "no_cross_contamination_non_halal", "halal_only_meat_supplier", "halal_only_serving_utensils"]
  },
  "service_styles": {
    "type": "multi_select",
    "label": "Service styles",
    "options": ["plated", "buffet", "family_style", "boodle_fight_halal", "intimate_only"]
  },
  "barmm_serving_experience":            { "type": "boolean", "label": "Experience serving BARMM weddings" },
  "metro_manila_muslim_community_exp":   { "type": "boolean", "label": "Experience with Metro Manila Muslim community" },
  "arabic_naming_support":               { "type": "boolean", "label": "Arabic naming / signage support" },
  "headcount_range_min":                 { "type": "int", "label": "Headcount range — minimum" },
  "headcount_range_max":                 { "type": "int", "label": "Headcount range — maximum" },
  "certification_doc_uploads_count":     { "type": "int", "min": 1, "label": "Upload Halal certification document (at least 1)" },
  "sample_menu_uploads_count":           { "type": "int", "min": 1, "label": "Upload at least 1 sample menu" }
}
$json$::jsonb,
    filter_facets = $json$["halal_certification_body", "cuisine_specialties", "halal_kitchen_segregation", "barmm_serving_experience", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["halal_certification_body", "cuisine_specialties", "service_regions"],
  "minimum_uploads": { "certification_doc": 1, "sample_menu": 1, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'halal_catering';

-- ----------------------------------------------------------------------------
-- 4. mocktail_only_caterer — INC + Muslim wedding-ready (full-scale catering)
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "inc_compliance": {
    "type": "enum",
    "label": "INC compliance level",
    "options": ["strict_no_alcohol_anywhere", "alcohol_free_drinks_only_recipes_unverified", "certified_alcohol_free_everywhere"],
    "required": true
  },
  "drink_categories": {
    "type": "multi_select",
    "label": "Drink categories",
    "options": ["fruit_blends", "herbal_infusions", "sparkling_mocktails", "tea_based", "coffee_based", "dessert_drinks", "savory_mocktails", "tropical_pinoy"],
    "required": true
  },
  "presentation_style": {
    "type": "multi_select",
    "label": "Presentation style",
    "options": ["garnished_glassware", "mason_jar_rustic", "custom_branded", "biodegradable_cups", "couple_signature_drinks"]
  },
  "muslim_friendly":              { "type": "boolean", "label": "Muslim-wedding friendly (no alcohol-derived ingredients)" },
  "drink_menu_count":             { "type": "int", "min": 8, "label": "Drink menu count (at least 8)" },
  "couple_signature_drink_custom": { "type": "boolean", "label": "Custom couple-signature drink offered" },
  "attendant_included":           { "type": "boolean", "label": "Attendant included" },
  "hours_typical":                { "type": "int", "label": "Typical service hours" },
  "sample_menu_uploads_count":    { "type": "int", "min": 1, "label": "Upload at least 1 sample menu" }
}
$json$::jsonb,
    filter_facets = $json$["inc_compliance", "drink_categories", "muslim_friendly", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["inc_compliance", "drink_categories", "drink_menu_count", "service_regions"],
  "minimum_uploads": { "sample_menu": 1, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'mocktail_only_caterer';

-- ----------------------------------------------------------------------------
-- 5. food_truck — mobile kitchen-on-wheels
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "cuisine_type": {
    "type": "multi_select",
    "label": "Cuisine type",
    "options": ["burgers", "pizza", "tacos", "asian_fusion", "filipino_street_food", "ice_cream_desserts", "coffee_specialty", "vegan_specialty", "breakfast_brunch", "grilled_skewers"],
    "required": true
  },
  "truck_size": {
    "type": "enum",
    "label": "Truck size",
    "options": ["small_8_to_15_orders_per_hour", "medium_15_to_30", "large_30_plus"]
  },
  "staff_configuration": {
    "type": "enum",
    "label": "Staff configuration",
    "options": ["solo_chef_only", "chef_plus_one_attendant", "chef_plus_multiple_attendants"]
  },
  "power_self_sufficient":     { "type": "boolean", "label": "Self-sufficient power (no venue hookup needed)" },
  "water_self_sufficient":     { "type": "boolean", "label": "Self-sufficient water" },
  "drive_access_required":     { "type": "boolean", "label": "Drive-in access required at venue" },
  "indoor_event_capable":      { "type": "boolean", "label": "Capable of indoor-event serving" },
  "setup_footprint_sqm":       { "type": "int", "label": "Setup footprint (sqm)" },
  "menu_item_count":           { "type": "int", "min": 5, "label": "Menu item count (at least 5)" },
  "sample_photos_uploads_count": { "type": "int", "min": 5, "label": "Upload at least 5 sample photos" }
}
$json$::jsonb,
    filter_facets = $json$["cuisine_type", "truck_size", "indoor_event_capable", "faith_compatibility", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["cuisine_type", "truck_size", "service_regions"],
  "minimum_uploads": { "sample_photos": 5, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'food_truck';

-- ----------------------------------------------------------------------------
-- 6. dessert_station — tiered desserts, candy buffet, etc.
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "dessert_types": {
    "type": "multi_select",
    "label": "Dessert types",
    "options": ["pastries", "macarons", "cupcakes", "chocolate_fountain", "candy_buffet", "donut_wall", "churros", "native_filipino_kakanin", "ice_cream_scoops", "sorbet"],
    "required": true
  },
  "presentation_style": {
    "type": "enum",
    "label": "Presentation style",
    "options": ["tiered_display", "table_spread", "themed_cart", "wall_mounted", "candy_bar"]
  },
  "custom_branding": {
    "type": "multi_select",
    "label": "Custom branding",
    "options": ["couple_monogram_on_items", "custom_packaging", "themed_signage", "couple_named_dessert"]
  },
  "specialty_dietary": {
    "type": "multi_select",
    "label": "Specialty dietary options",
    "options": ["gluten_free_options", "vegan_options", "sugar_free_options", "nut_free_options"]
  },
  "item_count_estimate":        { "type": "int", "label": "Item count estimate" },
  "attendant_included":         { "type": "boolean", "label": "Attendant included" },
  "hours_typical":              { "type": "int", "label": "Typical service hours" },
  "sample_photos_uploads_count": { "type": "int", "min": 3, "label": "Upload at least 3 dessert photos" }
}
$json$::jsonb,
    filter_facets = $json$["dessert_types", "presentation_style", "specialty_dietary", "faith_compatibility", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["dessert_types", "presentation_style", "service_regions"],
  "minimum_uploads": { "sample_photos": 3, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'dessert_station';

-- ----------------------------------------------------------------------------
-- 7. mocktail_bar — full-scale mocktail bar (INC + Muslim wedding-ready)
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "inc_compliance": {
    "type": "enum",
    "label": "INC compliance level",
    "options": ["strict_no_alcohol_anywhere", "alcohol_free_drinks_only_other_unverified", "certified_alcohol_free_everywhere"],
    "required": true
  },
  "bar_styles": {
    "type": "multi_select",
    "label": "Bar styles",
    "options": ["tropical_tiki", "classic_speakeasy", "fruit_forward", "coffee_focused", "tea_focused", "kombucha_fermented", "themed_couples_drinks"],
    "required": true
  },
  "muslim_friendly":              { "type": "boolean", "label": "Muslim-wedding friendly" },
  "drink_menu_count":             { "type": "int", "min": 8, "label": "Drink menu count (at least 8)" },
  "bartender_included":           { "type": "boolean", "label": "Bartender included" },
  "custom_couple_signature_drinks": { "type": "boolean", "label": "Custom couple-signature drinks" },
  "glassware_provided":           { "type": "boolean", "label": "Glassware provided" },
  "cup_branding_options": {
    "type": "multi_select",
    "label": "Cup branding options",
    "options": ["plain", "couple_monogram", "custom_design", "biodegradable_kraft"]
  },
  "hours_typical":                { "type": "int", "label": "Typical service hours" }
}
$json$::jsonb,
    filter_facets = $json$["inc_compliance", "bar_styles", "muslim_friendly", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["inc_compliance", "bar_styles", "drink_menu_count", "service_regions"],
  "minimum_uploads": { "sample_drinks_photos": 3, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'mocktail_bar';

-- ----------------------------------------------------------------------------
-- 8. halo_halo_station — PH-specific shaved-ice dessert booth
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "halo_halo_styles": {
    "type": "multi_select",
    "label": "Halo-halo styles",
    "options": ["classic_pinoy", "premium_loaded", "build_your_own", "regional_specialty_aklan", "regional_specialty_pampanga", "modernized_fusion"],
    "required": true
  },
  "toppings_count":                  { "type": "int", "min": 8, "label": "Toppings offered (at least 8)" },
  "ice_shaving_method": {
    "type": "enum",
    "label": "Ice shaving method",
    "options": ["hand_shaved_traditional", "machine_shaved", "snow_ice_modern"]
  },
  "serving_vessels": {
    "type": "multi_select",
    "label": "Serving vessels",
    "options": ["classic_glass_tall", "coconut_shell", "mason_jar", "themed_couple_cup", "biodegradable_bowl"]
  },
  "presentation_style": {
    "type": "enum",
    "label": "Presentation style",
    "options": ["cart_classic", "modern_minimalist", "traditional_filipino_themed"]
  },
  "customizes_native_filipino_toppings": { "type": "boolean", "label": "Includes native Filipino toppings (langka, ube, leche flan, etc.)" },
  "customization_for_couple":      { "type": "boolean", "label": "Couple-customization available" },
  "footprint_size":                { "type": "enum", "label": "Footprint size", "options": ["mini", "standard", "grand"] },
  "attendant_included":            { "type": "boolean", "label": "Attendant included" },
  "hours_typical":                 { "type": "int", "label": "Typical service hours" }
}
$json$::jsonb,
    filter_facets = $json$["halo_halo_styles", "toppings_count", "serving_vessels", "footprint_size", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["halo_halo_styles", "toppings_count", "service_regions"],
  "minimum_uploads": { "sample_photos": 3, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'halo_halo_station';

-- ----------------------------------------------------------------------------
-- 9. ice_cream_cart — themed ice cream cart
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "ice_cream_brands":              { "type": "multi_select_open", "label": "Ice cream brands carried (e.g., Carmen's Best, Sebastian's, Magnolia)" },
  "flavors_offered_count":         { "type": "int", "min": 5, "label": "Flavors offered (at least 5)" },
  "cone_options": {
    "type": "multi_select",
    "label": "Cone / cup options",
    "options": ["sugar_cone", "waffle_cone", "plain_cup", "biodegradable_cup"]
  },
  "cart_styles": {
    "type": "multi_select",
    "label": "Cart aesthetic",
    "options": ["vintage_classic_pinoy", "modern_white_cart", "themed_couple", "branded_premium"]
  },
  "specialty_dietary": {
    "type": "multi_select",
    "label": "Specialty dietary",
    "options": ["dairy_free_options", "vegan_sorbet", "sugar_free_options", "nut_free_options"]
  },
  "self_serve_capable":          { "type": "boolean", "label": "Self-serve capable" },
  "attendant_included":          { "type": "boolean", "label": "Attendant included" },
  "custom_branding":             { "type": "boolean", "label": "Custom branding (couple monogram / themed signage)" },
  "hours_typical":               { "type": "int", "label": "Typical service hours" },
  "sample_photos_uploads_count": { "type": "int", "min": 3, "label": "Upload at least 3 cart / setup photos" }
}
$json$::jsonb,
    filter_facets = $json$["flavors_offered_count", "cart_styles", "specialty_dietary", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["flavors_offered_count", "service_regions"],
  "minimum_uploads": { "sample_photos": 3, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'ice_cream_cart';

-- ----------------------------------------------------------------------------
-- 10. crepe_pancake_station — sweet + savory griddle station
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "item_types": {
    "type": "multi_select",
    "label": "Item types",
    "options": ["sweet_crepes", "savory_crepes", "american_pancakes", "japanese_souffle_pancakes", "filipino_bibingka_style"],
    "required": true
  },
  "toppings_count":          { "type": "int", "min": 6, "label": "Toppings count (at least 6)" },
  "custom_branding_options": {
    "type": "multi_select",
    "label": "Custom branding options",
    "options": ["couple_monogram_on_packaging", "themed_signage", "custom_filling_named_after_couple"]
  },
  "cooking_method": {
    "type": "enum",
    "label": "Cooking method",
    "options": ["griddle_classic", "electric_pancake_iron", "traditional_pan"]
  },
  "attendant_included": { "type": "boolean", "label": "Attendant included" },
  "hours_typical":      { "type": "int", "label": "Typical service hours" },
  "sample_photos_uploads_count": { "type": "int", "min": 3, "label": "Upload at least 3 sample photos" }
}
$json$::jsonb,
    filter_facets = $json$["item_types", "toppings_count", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["item_types", "service_regions"],
  "minimum_uploads": { "sample_photos": 3, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'crepe_pancake_station';

-- ----------------------------------------------------------------------------
-- 11. cotton_candy_cart — themed cotton candy
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "colors_offered": {
    "type": "multi_select",
    "label": "Colors offered",
    "options": ["classic_pink", "blue", "purple", "multicolor", "custom_couple_palette"]
  },
  "flavor_variations": {
    "type": "multi_select",
    "label": "Flavor variations",
    "options": ["classic_sugar", "fruit_flavored", "themed_specialty", "bubble_gum"]
  },
  "cart_styles": {
    "type": "multi_select",
    "label": "Cart styles",
    "options": ["vintage_carnival", "modern_minimalist", "themed_couple", "branded_premium"]
  },
  "custom_branding":             { "type": "boolean", "label": "Custom branding offered" },
  "attendant_included":          { "type": "boolean", "label": "Attendant included" },
  "estimated_servings_per_hour": { "type": "int", "label": "Estimated servings per hour" },
  "hours_typical":               { "type": "int", "label": "Typical service hours" }
}
$json$::jsonb,
    filter_facets = $json$["colors_offered", "cart_styles", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["colors_offered", "service_regions"],
  "minimum_uploads": { "sample_photos": 2, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'cotton_candy_cart';

-- ----------------------------------------------------------------------------
-- 12. charcuterie_board — cheese + cured meats grazing
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "board_themes": {
    "type": "multi_select",
    "label": "Board themes",
    "options": ["classic_european", "mediterranean", "filipino_fusion_native_cheeses", "vegan_charcuterie", "dessert_charcuterie", "breakfast_brunch"],
    "required": true
  },
  "cheese_count_typical":      { "type": "int", "label": "Typical cheese variety count" },
  "cured_meat_count_typical":  { "type": "int", "label": "Typical cured-meat variety count" },
  "accompaniments": {
    "type": "multi_select",
    "label": "Accompaniments",
    "options": ["crackers_artisan", "fresh_fruits", "dried_fruits", "nuts_varied", "honey_jams", "olives_pickled", "gourmet_breads"]
  },
  "presentation_styles": {
    "type": "multi_select",
    "label": "Presentation styles",
    "options": ["wooden_board_classic", "marble_modern", "themed_centerpiece", "individual_grazing_boxes"]
  },
  "dietary_specialties": {
    "type": "multi_select",
    "label": "Dietary specialties",
    "options": ["vegan_only", "gluten_free_only", "halal_only", "kosher_only"]
  },
  "custom_size_for_headcount":   { "type": "boolean", "label": "Custom size to fit headcount" },
  "sample_photos_uploads_count": { "type": "int", "min": 3, "label": "Upload at least 3 sample boards" }
}
$json$::jsonb,
    filter_facets = $json$["board_themes", "dietary_specialties", "faith_compatibility", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["board_themes", "service_regions"],
  "minimum_uploads": { "sample_photos": 3, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'charcuterie_board';

-- ----------------------------------------------------------------------------
-- 13. mini_lechon_station — PH-specific booth-scale lechon
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "mini_lechon_sizes": {
    "type": "multi_select",
    "label": "Mini lechon sizes",
    "options": ["single_serving", "small_share_4_6_pax", "medium_8_10_pax"],
    "required": true
  },
  "cooking_method": {
    "type": "enum",
    "label": "Cooking method",
    "options": ["pre_cooked_warm_held", "live_carving_on_site", "partial_on_site_finishing"]
  },
  "sauce_options": {
    "type": "multi_select",
    "label": "Sauce options",
    "options": ["liver_sauce_classic", "mang_tomas", "custom_vinegar", "soy_garlic"]
  },
  "pig_origin": {
    "type": "enum",
    "label": "Pig origin",
    "options": ["native_pig", "commercial", "organic_pasture_raised"]
  },
  "boneless_option":                 { "type": "boolean", "label": "Boneless option available" },
  "on_site_carving_attendant":       { "type": "boolean", "label": "On-site carving attendant" },
  "custom_couple_branding":          { "type": "boolean", "label": "Custom signage / couple branding" },
  "footprint_size":                  { "type": "enum", "label": "Footprint size", "options": ["mini", "standard", "grand"] },
  "advance_booking_days":            { "type": "int", "label": "Advance booking required (days)" }
}
$json$::jsonb,
    filter_facets = $json$["mini_lechon_sizes", "cooking_method", "boneless_option", "footprint_size", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["mini_lechon_sizes", "cooking_method", "service_regions"],
  "minimum_uploads": { "sample_photos": 3, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'mini_lechon_station';

-- ----------------------------------------------------------------------------
-- 14. whiskey_cigar_bar — premium spirits + cigar lounge
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "spirit_categories": {
    "type": "multi_select",
    "label": "Spirit categories",
    "options": ["scotch_whiskey", "bourbon", "irish_whiskey", "japanese_whiskey", "cognac", "rum_premium", "gin_artisanal", "tequila_premium"],
    "required": true
  },
  "cigar_selection_count":              { "type": "int", "label": "Cigar selection count" },
  "sommelier_master_attendant_included": { "type": "boolean", "label": "Sommelier / spirit-master attendant included" },
  "tasting_flights_offered":            { "type": "boolean", "label": "Tasting flights offered" },
  "custom_couple_pairing":              { "type": "boolean", "label": "Custom couple-pairing curation" },
  "humidor_setup_on_site":              { "type": "boolean", "label": "Humidor setup on-site" },
  "outdoor_smoking_area_required":      { "type": "boolean", "label": "Outdoor smoking area required at venue" },
  "licensed_alcohol_service":           { "type": "boolean", "label": "Licensed alcohol service" },
  "hours_typical":                      { "type": "int", "label": "Typical service hours" }
}
$json$::jsonb,
    filter_facets = $json$["spirit_categories", "cigar_selection_count", "outdoor_smoking_area_required", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["spirit_categories", "service_regions"],
  "minimum_uploads": { "sample_setup_photos": 3, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'whiskey_cigar_bar';

-- ----------------------------------------------------------------------------
-- 15. mocktail_booth_mini — booth-scale mocktail (INC + Muslim wedding-ready)
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "inc_compliance": {
    "type": "enum",
    "label": "INC compliance level",
    "options": ["strict_no_alcohol_anywhere", "alcohol_free_drinks_only_other_unverified"],
    "required": true
  },
  "drink_styles": {
    "type": "multi_select",
    "label": "Drink styles",
    "options": ["tropical", "fruit_forward", "herbal_infused", "sparkling", "dessert_drinks"]
  },
  "muslim_friendly":         { "type": "boolean", "label": "Muslim-wedding friendly" },
  "drink_menu_count":        { "type": "int", "min": 5, "label": "Drink menu count (at least 5)" },
  "custom_signature_drinks": { "type": "boolean", "label": "Custom couple-signature drinks" },
  "attendant_included":      { "type": "boolean", "label": "Attendant included" },
  "footprint_size":          { "type": "enum", "label": "Footprint size", "options": ["mini", "standard"] },
  "hours_typical":           { "type": "int", "label": "Typical service hours" }
}
$json$::jsonb,
    filter_facets = $json$["inc_compliance", "drink_styles", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["inc_compliance", "drink_menu_count", "service_regions"],
  "minimum_uploads": { "sample_photos": 2, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'mocktail_booth_mini';

-- ----------------------------------------------------------------------------
-- 16. tea_bar — tea ceremony + tea-tasting booth
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "tea_categories": {
    "type": "multi_select",
    "label": "Tea categories",
    "options": ["classic_chinese", "japanese_matcha", "indian_chai", "herbal_infusions", "milk_tea_taiwanese", "korean_traditional", "filipino_native_herbs"],
    "required": true
  },
  "serving_style": {
    "type": "enum",
    "label": "Serving style",
    "options": ["traditional_ceremony", "modern_self_serve", "attendant_pour", "themed_experience"]
  },
  "cultural_authenticity_certifications": {
    "type": "multi_select",
    "label": "Cultural authenticity certifications",
    "options": ["japanese_tea_master", "chinese_tea_specialist", "ayurvedic_practitioner"]
  },
  "cup_options": {
    "type": "multi_select",
    "label": "Cup options",
    "options": ["traditional_ceramic", "modern_glass", "biodegradable", "custom_branded"]
  },
  "sweetener_options": {
    "type": "multi_select",
    "label": "Sweetener options",
    "options": ["honey", "sugar", "alternative_sweeteners", "no_sugar"]
  },
  "hot_and_cold_options": { "type": "boolean", "label": "Both hot and cold tea options" },
  "attendant_included":   { "type": "boolean", "label": "Attendant included" },
  "advance_setup_minutes": { "type": "int", "label": "Advance setup (minutes)" },
  "hours_typical":         { "type": "int", "label": "Typical service hours" }
}
$json$::jsonb,
    filter_facets = $json$["tea_categories", "serving_style", "cultural_authenticity_certifications", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["tea_categories", "serving_style", "service_regions"],
  "minimum_uploads": { "sample_photos": 3, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'tea_bar';

COMMIT;
