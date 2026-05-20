-- ============================================================================
-- 20260522060000_iteration_0044_look_category_rich_schemas.sql
--
-- Iteration 0044 — Per-category schemas for Column 4 of the master taxonomy
-- (Look — Attire / Beauty / Jewelry / Decor). 54 canonical_services gain
-- full category_specific_attributes + filter_facets + required_for_visibility.
--
-- Already rich (skip): bridal_gown_custom, florals, stylist_decorator (PR #167).
--
-- Categories enriched (54):
--   Bridal wear (14): bridal_gown_rental · bridesmaid_dress · mother_of_bride_gown ·
--                     flower_girl_dress · junior_bridesmaid_dress ·
--                     filipiniana_terno · filipiniana_maria_clara ·
--                     filipiniana_balintawak · ninang_attire ·
--                     muslim_modest_bridal · inc_modest_bridal ·
--                     maranao_wedding_attire · tausug_wedding_attire ·
--                     yakan_wedding_attire
--   Groom wear (8):   groom_suit_custom · groom_suit_rental ·
--                     barong_tagalog_custom · barong_tagalog_rental ·
--                     groomsman_set · junior_groomsman · ring_bearer_suit ·
--                     ninong_attire
--   Beauty & grooming (13): bridal_hmua · family_mua · bridal_hair_stylist ·
--                     touchup_mua · bridal_spa · bridal_fitness ·
--                     bridal_nutritionist · bridal_dermatology · bridal_dental ·
--                     groom_grooming · muslim_henna_artist · maternity_bride_mua ·
--                     mature_bride_mua
--   Jewelry & accessories (11): engagement_ring · wedding_ring · bridal_jewellery ·
--                     bridal_jewellery_rental · wedding_veil · bridal_bouquet_specialty ·
--                     wedding_garter · bridal_headpiece · sponsor_corsage ·
--                     flower_girl_tiara · floral_jewellery
--   Decor & styling (8): decorator_general · garden_wedding_florist ·
--                     beach_wedding_florist · capiz_native_decor ·
--                     hacienda_heritage_decor · maranao_okir_decor ·
--                     setnayan_pailaw · setnayan_custom_monogram
--
-- PH-cultural depth: Filipiniana 3 styles (terno / Maria Clara / Balintawak) +
-- Muslim ethno-cultural bridal (Maranao / Tausug / Yakan) + Filipino sponsor
-- attire (ninang / ninong) + barong tagalog custom + rental + capiz/abaca
-- native decor + Maranao okir motifs + hacienda heritage themes.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ============================================================================
-- BRIDAL WEAR (14)
-- ============================================================================

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "rental_silhouettes":            { "type": "multi_select", "label": "Silhouettes", "options": ["a_line", "ball_gown", "mermaid", "trumpet", "sheath", "tea_length", "fit_and_flare"], "required": true },
    "size_range_carried":            { "type": "enum", "label": "Size range carried", "options": ["xs_to_l", "xs_to_xl", "plus_size_inclusive", "petite_specialty"] },
    "alteration_included":           { "type": "boolean", "label": "Alterations included" },
    "security_deposit_required":     { "type": "boolean", "label": "Security deposit required" },
    "return_window_days":            { "type": "int", "label": "Return window (days)" },
    "sample_uploads_count":          { "type": "int", "min": 8, "label": "Sample gown photos (at least 8)" }
  }
  $json$::jsonb,
  filter_facets = $json$["rental_silhouettes", "size_range_carried", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["rental_silhouettes", "service_regions"], "minimum_uploads": { "sample_photos": 8 } } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'bridal_gown_rental';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "color_palette_options":         { "type": "multi_select_open", "label": "Color palettes (e.g., dusty rose, sage, blush)" },
    "made_to_measure":               { "type": "boolean", "label": "Made-to-measure capable" },
    "off_rack_available":            { "type": "boolean", "label": "Off-rack available" },
    "sizing_range":                  { "type": "enum", "label": "Sizing range", "options": ["xs_to_l", "xs_to_xl", "plus_size_inclusive"] },
    "group_discount_options":        { "type": "boolean", "label": "Group discount options" }
  }
  $json$::jsonb,
  filter_facets = $json$["color_palette_options", "made_to_measure", "sizing_range", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'bridesmaid_dress';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "dress_styles":                  { "type": "multi_select", "label": "Dress styles", "options": ["modest_traditional", "elegant_modern", "themed_filipiniana_modern", "color_coordinated"], "required": true },
    "color_recommendations":         { "type": "boolean", "label": "Color recommendations service" },
    "made_to_measure":               { "type": "boolean", "label": "Made-to-measure capable" }
  }
  $json$::jsonb,
  filter_facets = $json$["dress_styles", "made_to_measure", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["dress_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'mother_of_bride_gown';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "dress_styles":                  { "type": "multi_select", "label": "Dress styles", "options": ["traditional_white", "themed_colored", "modern_minimalist", "filipiniana_inspired"], "required": true },
    "size_range_age":                { "type": "multi_select", "label": "Age range", "options": ["3_to_5", "5_to_8", "8_to_12"] },
    "customization_options":         { "type": "boolean", "label": "Customization options" }
  }
  $json$::jsonb,
  filter_facets = $json$["dress_styles", "size_range_age", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["dress_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'flower_girl_dress';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "dress_styles":                  { "type": "multi_select", "label": "Dress styles", "options": ["matched_with_bridesmaid", "modified_age_appropriate", "themed"], "required": true },
    "color_match_with_bridesmaid":   { "type": "boolean", "label": "Color match with bridesmaid possible" },
    "sizing_age_range":              { "type": "multi_select", "label": "Sizing age range", "options": ["10_to_12", "12_to_14", "14_to_16"] }
  }
  $json$::jsonb,
  filter_facets = $json$["dress_styles", "color_match_with_bridesmaid", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["dress_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'junior_bridesmaid_dress';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "design_styles":                 { "type": "multi_select", "label": "Design styles", "options": ["traditional_butterfly_sleeve", "modern_terno", "colonial_revival", "minimalist_modern"], "required": true },
    "fabric_options":                { "type": "multi_select", "label": "Fabric options", "options": ["pina", "jusi", "silk", "embroidered", "beaded"] },
    "embroidery_options":            { "type": "multi_select", "label": "Embroidery options", "options": ["calado", "callado", "barong_embroidery_classic", "modern_couture"] },
    "fittings_included_count":       { "type": "int", "label": "Fittings included" }
  }
  $json$::jsonb,
  filter_facets = $json$["design_styles", "fabric_options", "embroidery_options", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["design_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'filipiniana_terno';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "design_styles":                 { "type": "multi_select", "label": "Design styles", "options": ["traditional_classic", "modernized_split_pana_saya", "themed_couture"], "required": true },
    "pana_saya_integration":         { "type": "enum", "label": "Pana / saya integration", "options": ["separate_two_piece", "integrated_one_piece"] },
    "fabric_options":                { "type": "multi_select", "label": "Fabric options", "options": ["pina", "jusi", "silk", "lace_overlay"] }
  }
  $json$::jsonb,
  filter_facets = $json$["design_styles", "pana_saya_integration", "fabric_options", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["design_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'filipiniana_maria_clara';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "design_styles":                 { "type": "multi_select", "label": "Design styles", "options": ["rural_traditional", "festival_celebratory", "modernized_lifestyle"], "required": true },
    "color_palette_traditional":     { "type": "boolean", "label": "Traditional color palette (red / yellow / earth tones)" },
    "skirt_styles":                  { "type": "multi_select", "label": "Skirt styles", "options": ["full_circle", "tiered", "asymmetric_panuelo"] }
  }
  $json$::jsonb,
  filter_facets = $json$["design_styles", "skirt_styles", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["design_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'filipiniana_balintawak';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "dress_styles":                  { "type": "multi_select", "label": "Dress styles", "options": ["traditional_formal", "modern_elegant", "filipiniana_inspired", "themed_color_coordinated"], "required": true },
    "color_coordination_with_bride": { "type": "boolean", "label": "Color coordination with bride's palette" },
    "customization":                 { "type": "boolean", "label": "Customization available" }
  }
  $json$::jsonb,
  filter_facets = $json$["dress_styles", "color_coordination_with_bride", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["dress_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'ninang_attire';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "design_styles":                 { "type": "multi_select", "label": "Design styles", "options": ["modern_hijab_friendly", "traditional_kebaya", "modest_jubah", "couture_modernized"], "required": true },
    "color_palette":                 { "type": "multi_select_open", "label": "Color palette" },
    "embellishment_levels":          { "type": "enum", "label": "Embellishment level", "options": ["minimal", "moderate", "elaborate_couture"] },
    "hijab_styling_included":        { "type": "boolean", "label": "Hijab styling included" }
  }
  $json$::jsonb,
  filter_facets = $json$["design_styles", "embellishment_levels", "hijab_styling_included", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["design_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'muslim_modest_bridal';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "modesty_compliance_strict":     { "type": "boolean", "label": "Strict INC modesty compliance (covered shoulders + back)", "required": true },
    "no_low_cut_no_back_exposed":    { "type": "boolean", "label": "No low-cut / no back-exposed" },
    "sleeve_length_min":             { "type": "enum", "label": "Minimum sleeve length", "options": ["short_3_quarter", "long_full", "long_with_gloves"] },
    "design_styles":                 { "type": "multi_select", "label": "Design styles", "options": ["traditional_modest", "modern_elegant_covered", "filipiniana_modest"] }
  }
  $json$::jsonb,
  filter_facets = $json$["modesty_compliance_strict", "sleeve_length_min", "design_styles", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["modesty_compliance_strict", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'inc_modest_bridal';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "malong_inspired_styles":        { "type": "multi_select", "label": "Malong-inspired styles", "options": ["traditional_landap", "modernized_dress", "kebaya_inspired"], "required": true },
    "traditional_okir_motifs":       { "type": "boolean", "label": "Traditional okir motifs included" },
    "jewelry_pairing":               { "type": "boolean", "label": "Traditional jewelry pairing service" }
  }
  $json$::jsonb,
  filter_facets = $json$["malong_inspired_styles", "traditional_okir_motifs", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["malong_inspired_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'maranao_wedding_attire';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "beadwork_styles":               { "type": "multi_select", "label": "Beadwork styles", "options": ["traditional_heavy_bead", "contemporary_minimal", "modernized_couture"], "required": true },
    "traditional_textile_options":   { "type": "multi_select", "label": "Traditional textile", "options": ["pis_siabit", "kandit", "modern_silk"] },
    "weaving_certifications":        { "type": "boolean", "label": "Traditional weaving certified by community" }
  }
  $json$::jsonb,
  filter_facets = $json$["beadwork_styles", "traditional_textile_options", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["beadwork_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'tausug_wedding_attire';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "yakan_textile_authentic":       { "type": "boolean", "label": "Authentic Yakan textile sourced", "required": true },
    "weaving_certifications":        { "type": "multi_select", "label": "Weaving certifications", "options": ["yakan_community_certified", "ncca_recognized"] },
    "color_traditions":              { "type": "multi_select", "label": "Traditional colors", "options": ["red_yellow_classic", "indigo_blue_traditional", "earth_tones_natural"] }
  }
  $json$::jsonb,
  filter_facets = $json$["yakan_textile_authentic", "weaving_certifications", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["yakan_textile_authentic", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'yakan_wedding_attire';

-- ============================================================================
-- GROOM WEAR (8)
-- ============================================================================

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "suit_styles":                   { "type": "multi_select", "label": "Suit styles", "options": ["classic_two_piece", "modern_slim", "tuxedo", "three_piece", "destination_linen"], "required": true },
    "fabric_options":                { "type": "multi_select", "label": "Fabric options", "options": ["wool_classic", "linen_destination", "silk_premium", "tropical_lightweight"] },
    "fittings_included_count":       { "type": "int", "label": "Fittings included" },
    "lead_time_weeks":               { "type": "int", "label": "Lead time (weeks)" }
  }
  $json$::jsonb,
  filter_facets = $json$["suit_styles", "fabric_options", "lead_time_weeks", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["suit_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'groom_suit_custom';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "rental_styles":                 { "type": "multi_select", "label": "Rental styles", "options": ["classic_black_tie", "modern_navy_grey", "tuxedo_premium", "themed_specialty"] },
    "size_range":                    { "type": "enum", "label": "Size range carried", "options": ["s_to_xl", "xs_to_xxl", "big_and_tall_inclusive"] },
    "alteration_included":           { "type": "boolean", "label": "Alterations included" },
    "return_window_days":            { "type": "int", "label": "Return window (days)" }
  }
  $json$::jsonb,
  filter_facets = $json$["rental_styles", "size_range", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["rental_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'groom_suit_rental';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "barong_styles":                 { "type": "multi_select", "label": "Barong styles", "options": ["formal_white", "colored_modern", "embroidered_heritage", "minimalist_lightweight", "polo_barong_casual"], "required": true },
    "fabric_options":                { "type": "multi_select", "label": "Fabric options", "options": ["jusi", "silk", "cotton_poly", "pina"] },
    "embroidery_traditions":         { "type": "multi_select", "label": "Embroidery traditions", "options": ["calado_classic", "modern_couture", "regional_traditional", "minimal_modern"] },
    "fittings_included_count":       { "type": "int", "label": "Fittings included" }
  }
  $json$::jsonb,
  filter_facets = $json$["barong_styles", "fabric_options", "embroidery_traditions", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["barong_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'barong_tagalog_custom';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "rental_styles":                 { "type": "multi_select", "label": "Rental styles", "options": ["formal_white", "colored_modern", "embroidered_premium"] },
    "size_range":                    { "type": "enum", "label": "Size range", "options": ["s_to_xl", "xs_to_xxl"] },
    "alteration_included":           { "type": "boolean", "label": "Alterations included" },
    "return_window_days":            { "type": "int", "label": "Return window (days)" }
  }
  $json$::jsonb,
  filter_facets = $json$["rental_styles", "size_range", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["rental_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'barong_tagalog_rental';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "match_style":                   { "type": "enum", "label": "Match style", "options": ["matched_identical", "complementary_color_coordinated", "themed_grouped"], "required": true },
    "color_palette_options":         { "type": "multi_select_open", "label": "Color palettes" },
    "package_pricing":               { "type": "boolean", "label": "Package pricing available" },
    "group_size_typical":            { "type": "int", "label": "Typical group size" }
  }
  $json$::jsonb,
  filter_facets = $json$["match_style", "color_palette_options", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["match_style", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'groomsman_set';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "dress_styles":                  { "type": "multi_select", "label": "Suit styles", "options": ["mini_suit_classic", "mini_barong", "themed_specialty"], "required": true },
    "sizing_age_range":              { "type": "multi_select", "label": "Age range", "options": ["10_to_12", "12_to_14", "14_to_16"] },
    "color_match_with_groomsman":    { "type": "boolean", "label": "Color match with groomsman" }
  }
  $json$::jsonb,
  filter_facets = $json$["dress_styles", "sizing_age_range", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["dress_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'junior_groomsman';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "suit_styles":                   { "type": "multi_select", "label": "Suit styles", "options": ["mini_tuxedo", "mini_barong", "themed_specialty", "casual_smart"] },
    "age_range":                     { "type": "multi_select", "label": "Age range", "options": ["3_to_5", "5_to_8", "8_to_10"] },
    "customization_options":         { "type": "boolean", "label": "Customization options" }
  }
  $json$::jsonb,
  filter_facets = $json$["suit_styles", "age_range", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["suit_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'ring_bearer_suit';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "dress_styles":                  { "type": "multi_select", "label": "Dress styles", "options": ["traditional_barong", "modern_suit", "themed_color_coordinated", "filipiniana_traditional_formal"], "required": true },
    "color_coordination":            { "type": "boolean", "label": "Color coordination with groom" },
    "customization":                 { "type": "boolean", "label": "Customization available" }
  }
  $json$::jsonb,
  filter_facets = $json$["dress_styles", "color_coordination", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["dress_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'ninong_attire';

-- ============================================================================
-- BEAUTY & GROOMING (13)
-- ============================================================================

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "makeup_styles":                 { "type": "multi_select", "label": "Makeup styles", "options": ["natural_nofilter", "classic_timeless", "glamour_dramatic", "editorial_fashion", "ethereal_soft"], "required": true },
    "skin_tone_specialization":      { "type": "multi_select", "label": "Skin-tone specialization", "options": ["light_olive", "medium_tan", "deep_morena", "warm_undertones", "cool_undertones"] },
    "trial_session_included":        { "type": "boolean", "label": "Trial session included" },
    "long_wear_formulation":         { "type": "boolean", "label": "Long-wear formulation (12hr+ hold)" },
    "sample_uploads_count":          { "type": "int", "min": 6, "label": "Portfolio photos (at least 6)" }
  }
  $json$::jsonb,
  filter_facets = $json$["makeup_styles", "skin_tone_specialization", "trial_session_included", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["makeup_styles", "service_regions"], "minimum_uploads": { "portfolio_photos": 6 } } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'bridal_hmua';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "family_size_capable":           { "type": "enum", "label": "Family size capable", "options": ["small_3_to_6", "medium_6_to_12", "large_12plus"] },
    "makeup_styles_offered":         { "type": "multi_select", "label": "Makeup styles offered", "options": ["natural", "classic", "glamour", "themed"] },
    "group_pricing":                 { "type": "boolean", "label": "Group pricing available" }
  }
  $json$::jsonb,
  filter_facets = $json$["family_size_capable", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["family_size_capable", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'family_mua';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "hair_styling_styles":           { "type": "multi_select", "label": "Hair styling styles", "options": ["classic_updo", "loose_curls", "braided_intricate", "modern_chic", "ethereal_romantic", "sleek_low_bun"], "required": true },
    "trial_session_included":        { "type": "boolean", "label": "Trial session included" },
    "extension_capable":             { "type": "boolean", "label": "Hair extension capable" },
    "long_wear_hold":                { "type": "boolean", "label": "Long-wear product hold (12hr+)" }
  }
  $json$::jsonb,
  filter_facets = $json$["hair_styling_styles", "trial_session_included", "extension_capable", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["hair_styling_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'bridal_hair_stylist';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "coverage_hours":                { "type": "int", "label": "Coverage hours" },
    "mid_event_refresh_count":       { "type": "int", "label": "Mid-event refresh count" },
    "on_call_response_minutes":      { "type": "int", "label": "On-call response time (minutes)" }
  }
  $json$::jsonb,
  filter_facets = $json$["coverage_hours", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["coverage_hours", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'touchup_mua';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "treatment_types":               { "type": "multi_select", "label": "Treatment types", "options": ["facial", "massage", "manicure_pedicure", "skin_brightening", "body_scrub_polish", "hair_treatment"], "required": true },
    "package_styles":                { "type": "multi_select", "label": "Package styles", "options": ["bridal_focus", "couple_package", "family_group_session", "single_day_intensive"] },
    "session_count_typical":         { "type": "int", "label": "Session count typical" }
  }
  $json$::jsonb,
  filter_facets = $json$["treatment_types", "package_styles", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["treatment_types", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'bridal_spa';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "program_duration_weeks":        { "type": "int", "label": "Program duration (weeks)" },
    "fitness_styles":                { "type": "multi_select", "label": "Fitness styles", "options": ["cardio_focused", "strength_toning", "yoga_pilates", "dance_choreo", "hiit_intense"] },
    "in_home_or_studio":             { "type": "enum", "label": "Location", "options": ["in_home", "studio_only", "both"] },
    "online_capable":                { "type": "boolean", "label": "Online sessions capable" }
  }
  $json$::jsonb,
  filter_facets = $json$["program_duration_weeks", "fitness_styles", "in_home_or_studio", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["fitness_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'bridal_fitness';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "program_styles":                { "type": "multi_select", "label": "Program styles", "options": ["weight_loss", "glow_focused", "wellness_holistic", "energy_focused"] },
    "consultation_format":           { "type": "enum", "label": "Consultation format", "options": ["in_person", "online_zoom", "hybrid"] },
    "meal_plan_provided":            { "type": "boolean", "label": "Meal plan provided" }
  }
  $json$::jsonb,
  filter_facets = $json$["program_styles", "consultation_format", "starting_price_centavos"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["program_styles"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'bridal_nutritionist';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "treatments_available":          { "type": "multi_select", "label": "Treatments available", "options": ["facial", "laser_treatment", "chemical_peel", "medi_facial", "microneedling", "hydrafacial"], "required": true },
    "advance_planning_months":       { "type": "int", "label": "Advance planning recommended (months)" },
    "consultation_included":         { "type": "boolean", "label": "Consultation included" }
  }
  $json$::jsonb,
  filter_facets = $json$["treatments_available", "advance_planning_months", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["treatments_available", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'bridal_dermatology';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "treatments_available":          { "type": "multi_select", "label": "Treatments available", "options": ["whitening", "braces_invisalign", "veneers", "alignment_orthodontics", "cleaning_polish"], "required": true },
    "advance_planning_months":       { "type": "int", "label": "Advance planning recommended (months)" }
  }
  $json$::jsonb,
  filter_facets = $json$["treatments_available", "advance_planning_months", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["treatments_available", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'bridal_dental';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "services_available":            { "type": "multi_select", "label": "Services available", "options": ["haircut_style", "beard_grooming", "skincare_facial", "manicure_pedicure", "body_treatments"], "required": true },
    "advance_appointment_days":      { "type": "int", "label": "Advance appointment recommended (days)" }
  }
  $json$::jsonb,
  filter_facets = $json$["services_available", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["services_available", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'groom_grooming';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "henna_styles":                  { "type": "multi_select", "label": "Henna styles", "options": ["traditional_arabic", "modern_minimalist", "elaborate_bridal", "philippine_muslim_distinct"], "required": true },
    "session_duration_hours":        { "type": "int", "label": "Session duration (hours)" },
    "natural_dye_only":              { "type": "boolean", "label": "Natural dye only (no chemical PPD)" }
  }
  $json$::jsonb,
  filter_facets = $json$["henna_styles", "natural_dye_only", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["henna_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'muslim_henna_artist';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "experience_with_pregnant_brides": { "type": "boolean", "label": "Experience with pregnant brides", "required": true },
    "comfortable_seating_provided":  { "type": "boolean", "label": "Comfortable seating provided" },
    "extended_breaks_accommodated":  { "type": "boolean", "label": "Extended breaks accommodated" }
  }
  $json$::jsonb,
  filter_facets = $json$["experience_with_pregnant_brides", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["experience_with_pregnant_brides", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'maternity_bride_mua';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "skin_type_specialization":      { "type": "multi_select", "label": "Skin type specialization", "options": ["anti_aging", "lifting_techniques", "youthful_glow", "natural_radiance", "mature_skin_brightening"], "required": true },
    "age_range_specialized":         { "type": "multi_select", "label": "Age range specialized", "options": ["45_to_55", "55_to_65", "65plus"] }
  }
  $json$::jsonb,
  filter_facets = $json$["skin_type_specialization", "age_range_specialized", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["skin_type_specialization", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'mature_bride_mua';

-- ============================================================================
-- JEWELRY & ACCESSORIES (11)
-- ============================================================================

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "metal_options":                 { "type": "multi_select", "label": "Metal options", "options": ["gold_yellow", "gold_white", "gold_rose", "platinum", "silver", "palladium"], "required": true },
    "stone_options":                 { "type": "multi_select", "label": "Stone options", "options": ["diamond", "sapphire", "emerald", "ruby", "moissanite", "filipino_native_pearl", "no_stone"] },
    "customization":                 { "type": "boolean", "label": "Custom design available" },
    "certified_diamonds":            { "type": "boolean", "label": "GIA / certified diamonds available" }
  }
  $json$::jsonb,
  filter_facets = $json$["metal_options", "stone_options", "customization", "certified_diamonds", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["metal_options", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'engagement_ring';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "metal_options":                 { "type": "multi_select", "label": "Metal options", "options": ["gold_yellow", "gold_white", "gold_rose", "platinum", "silver"], "required": true },
    "stone_options":                 { "type": "multi_select", "label": "Stone options", "options": ["diamond_accents", "no_stone", "filipino_native_pearl"] },
    "design_styles":                 { "type": "multi_select", "label": "Design styles", "options": ["classic_plain", "modern_textured", "vintage_heritage", "couple_initials_engraved"] },
    "engraving_capable":             { "type": "boolean", "label": "Engraving capable" }
  }
  $json$::jsonb,
  filter_facets = $json$["metal_options", "design_styles", "engraving_capable", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["metal_options", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'wedding_ring';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "jewelry_types":                 { "type": "multi_select", "label": "Jewelry types", "options": ["necklace", "earrings", "bracelet", "anklet", "hair_clip"], "required": true },
    "metal_options":                 { "type": "multi_select", "label": "Metal options", "options": ["gold_yellow", "gold_white", "gold_rose", "silver", "rose_gold_plated"] },
    "package_offerings":             { "type": "boolean", "label": "Package offerings (matching sets)" }
  }
  $json$::jsonb,
  filter_facets = $json$["jewelry_types", "metal_options", "package_offerings", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["jewelry_types", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'bridal_jewellery';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "rental_styles":                 { "type": "multi_select", "label": "Rental styles", "options": ["classic_diamond_set", "vintage_heritage", "modern_minimalist", "themed_couture"] },
    "security_deposit_required":     { "type": "boolean", "label": "Security deposit required" },
    "insurance_included":            { "type": "boolean", "label": "Insurance coverage included" }
  }
  $json$::jsonb,
  filter_facets = $json$["rental_styles", "security_deposit_required", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["rental_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'bridal_jewellery_rental';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "veil_lengths":                  { "type": "multi_select", "label": "Veil lengths", "options": ["birdcage", "fingertip", "chapel", "cathedral"], "required": true },
    "customization":                 { "type": "boolean", "label": "Customization available" },
    "fabric_options":                { "type": "multi_select", "label": "Fabric options", "options": ["tulle_classic", "lace_overlay", "silk_organza", "embroidered_couture"] }
  }
  $json$::jsonb,
  filter_facets = $json$["veil_lengths", "fabric_options", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["veil_lengths", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'wedding_veil';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "bouquet_styles":                { "type": "multi_select", "label": "Bouquet styles", "options": ["classic_round", "cascade_long", "hand_tied_natural", "modern_minimalist", "themed_color"], "required": true },
    "flower_specialties":            { "type": "multi_select_open", "label": "Flower specialties" },
    "preservation_options":          { "type": "boolean", "label": "Preservation options (frame / resin)" }
  }
  $json$::jsonb,
  filter_facets = $json$["bouquet_styles", "flower_specialties", "preservation_options", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["bouquet_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'bridal_bouquet_specialty';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "styles":                        { "type": "multi_select", "label": "Garter styles", "options": ["traditional_lace", "modern_satin", "themed_personalized", "couple_initials_embroidered"] },
    "customization_couple_initials": { "type": "boolean", "label": "Couple initials customization" }
  }
  $json$::jsonb,
  filter_facets = $json$["styles", "customization_couple_initials", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'wedding_garter';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "headpiece_styles":              { "type": "multi_select", "label": "Headpiece styles", "options": ["tiara_classic", "crown_royal", "floral_crown", "hair_pins", "comb_decorative", "minimalist_band"], "required": true },
    "customization":                 { "type": "boolean", "label": "Customization available" }
  }
  $json$::jsonb,
  filter_facets = $json$["headpiece_styles", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["headpiece_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'bridal_headpiece';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "corsage_styles":                { "type": "multi_select", "label": "Corsage styles", "options": ["wrist_classic", "pin_on_traditional", "modern_minimalist", "themed_color"] },
    "flower_specialties":            { "type": "multi_select_open", "label": "Flower specialties" },
    "packaging_for_sponsors":        { "type": "boolean", "label": "Individual packaging for sponsors" }
  }
  $json$::jsonb,
  filter_facets = $json$["corsage_styles", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["corsage_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'sponsor_corsage';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "tiara_styles":                  { "type": "multi_select", "label": "Tiara styles", "options": ["princess_classic", "floral_inspired", "themed_color", "rhinestone_sparkle"] },
    "age_appropriate_design":        { "type": "multi_select", "label": "Age-appropriate design", "options": ["3_to_5", "5_to_8", "8_to_12"] },
    "customization":                 { "type": "boolean", "label": "Customization available" }
  }
  $json$::jsonb,
  filter_facets = $json$["tiara_styles", "age_appropriate_design", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["tiara_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'flower_girl_tiara';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "floral_jewelry_types":          { "type": "multi_select", "label": "Floral jewelry types", "options": ["necklace", "earrings", "bracelet", "hair_accessories", "anklet"] },
    "preservation_options":          { "type": "boolean", "label": "Preservation options (resin / dried)" },
    "flower_specialties":            { "type": "multi_select_open", "label": "Flower specialties" }
  }
  $json$::jsonb,
  filter_facets = $json$["floral_jewelry_types", "preservation_options", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["floral_jewelry_types", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'floral_jewellery';

-- ============================================================================
-- DECOR & STYLING (8)
-- ============================================================================

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "decor_styles":                  { "type": "multi_select", "label": "Decor styles", "options": ["modern_minimalist", "traditional_classic", "rustic_industrial", "bohemian_natural", "themed_specialty", "luxe_glamour"], "required": true },
    "theme_categories":              { "type": "multi_select", "label": "Theme categories", "options": ["garden_floral", "beach_destination", "indoor_ballroom", "outdoor_evening", "vintage_heritage"] },
    "venue_styling_included":        { "type": "boolean", "label": "Venue styling included" },
    "rental_props_inventory":        { "type": "boolean", "label": "Rental props inventory" }
  }
  $json$::jsonb,
  filter_facets = $json$["decor_styles", "theme_categories", "venue_styling_included", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["decor_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'decorator_general';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "floral_styles_garden":          { "type": "multi_select", "label": "Floral styles (garden)", "options": ["lush_overgrown", "minimalist_modern", "wild_natural", "garden_party_classic"], "required": true },
    "sustainability_practices":      { "type": "multi_select", "label": "Sustainability practices", "options": ["locally_sourced", "compostable_arrangements", "rental_structures", "seasonal_only"] },
    "location_familiarity":          { "type": "multi_select_open", "label": "Familiar garden venues" }
  }
  $json$::jsonb,
  filter_facets = $json$["floral_styles_garden", "sustainability_practices", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["floral_styles_garden", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'garden_wedding_florist';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "floral_styles_beach":           { "type": "multi_select", "label": "Floral styles (beach)", "options": ["tropical_lush", "minimalist_coastal", "wild_natural", "boho_relaxed"], "required": true },
    "weather_resilience":            { "type": "boolean", "label": "Weather-resilient arrangements (wind / salt / sun)" },
    "location_familiarity":          { "type": "multi_select_open", "label": "Familiar beach venues" }
  }
  $json$::jsonb,
  filter_facets = $json$["floral_styles_beach", "weather_resilience", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["floral_styles_beach", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'beach_wedding_florist';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "native_material_specialties":   { "type": "multi_select", "label": "Native material specialties", "options": ["capiz_shells", "abaca_woven", "rattan_furniture", "bamboo_structural", "native_pinoy_florals", "coconut_palm_fronds"], "required": true },
    "region_origin":                 { "type": "text_short", "label": "Region of origin (e.g., Quezon Capiz / Mindanao abaca)" }
  }
  $json$::jsonb,
  filter_facets = $json$["native_material_specialties", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["native_material_specialties", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'capiz_native_decor';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "heritage_themes":               { "type": "multi_select", "label": "Heritage themes", "options": ["colonial_spanish_revival", "casa_filipino", "old_world_european", "vintage_filipiniana"], "required": true },
    "location_partnerships":         { "type": "multi_select_open", "label": "Heritage venue partnerships" }
  }
  $json$::jsonb,
  filter_facets = $json$["heritage_themes", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["heritage_themes", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'hacienda_heritage_decor';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "okir_motif_specialties":        { "type": "multi_select", "label": "Okir motif specialties", "options": ["sarimanok_traditional", "torogan_inspired", "naga_serpentine", "minimalist_modern_okir"], "required": true },
    "traditional_color_palette":     { "type": "boolean", "label": "Traditional color palette (yellow / red / green / black)" }
  }
  $json$::jsonb,
  filter_facets = $json$["okir_motif_specialties", "traditional_color_palette", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["okir_motif_specialties", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'maranao_okir_decor';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "led_styles":                    { "type": "multi_select", "label": "LED styles", "options": ["wedding_backdrop", "monogram_panel", "ambient_room_lighting", "themed_animations"] },
    "customization_options":         { "type": "multi_select", "label": "Customization options", "options": ["couple_monogram", "themed_template", "custom_animation", "color_match_palette"] },
    "technical_setup_hours":         { "type": "int", "label": "Technical setup (hours)" }
  }
  $json$::jsonb,
  filter_facets = $json$["led_styles", "customization_options", "starting_price_centavos"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["led_styles"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'setnayan_pailaw';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "design_styles":                 { "type": "multi_select", "label": "Design styles", "options": ["classic_serif", "modern_sans_serif", "script_calligraphy", "themed_custom", "filipiniana_inspired"] },
    "customization_options":         { "type": "multi_select", "label": "Customization options", "options": ["couple_initials", "wedding_date_embedded", "color_palette_match", "themed_motifs"] },
    "delivery_formats":              { "type": "multi_select", "label": "Delivery formats", "options": ["digital_high_res", "printed_design_kit", "embroidered_application_kit"] }
  }
  $json$::jsonb,
  filter_facets = $json$["design_styles", "customization_options", "delivery_formats", "starting_price_centavos"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["design_styles"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'setnayan_custom_monogram';

COMMIT;
