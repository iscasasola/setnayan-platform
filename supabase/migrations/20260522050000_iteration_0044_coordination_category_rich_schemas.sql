-- ============================================================================
-- 20260522050000_iteration_0044_coordination_category_rich_schemas.sql
--
-- Iteration 0044 — Per-category schemas for Column 5 of the master taxonomy
-- (Ceremony · Coordination · Logistics · Stationery · Travel). 58
-- canonical_services gain full category_specific_attributes +
-- filter_facets + required_for_visibility.
--
-- Already rich (skip): wedding_coordination, officiant_priest_minister,
-- transportation_bridal_car (all PR #167).
--
-- Categories enriched (58):
--   Ceremony officiants (10):     catholic_priest · civil_judge · civil_mayor ·
--                                 civil_justice_of_peace · inc_minister ·
--                                 born_again_pastor · charismatic_pastor ·
--                                 mainline_protestant_pastor · muslim_imam ·
--                                 cultural_tribal_elder
--   Pre-marriage requirements (6): pre_cana_seminar · cfo_seminar · inc_counseling ·
--                                  muslim_pre_wedding_counseling ·
--                                  marriage_license_expediting ·
--                                  apostille_dfa_authentication
--   Planning & coordination (11):  wedding_planner_partial · day_of_coordinator ·
--                                  destination_wedding_specialist ·
--                                  pamamanhikan_coordinator · despedida_planner ·
--                                  sponsor_coordinator ·
--                                  gender_separated_reception_coordinator ·
--                                  religious_venue_coordinator ·
--                                  inc_wedding_coordinator · mahr_coordination ·
--                                  setnayan_concierge
--   Transportation (5):            vintage_classic_vehicle ·
--                                  transportation_guest_shuttle ·
--                                  motorcycle_escort · horse_drawn_carriage ·
--                                  bridal_boat_yacht
--   Logistics & infrastructure (10): generator_rental · tent_rental ·
--                                    mobile_restroom_rental · cooling_fans_misters ·
--                                    outdoor_sound_system · outdoor_lighting_specialist ·
--                                    bug_repellent_station · wedding_day_weather_forecaster ·
--                                    parasol_hat_rental · lights_sound
--   Stationery & keepsakes (13):   invitation_print · invitation_digital ·
--                                  wedding_cards_designer · save_the_date_digital ·
--                                  setnayan_save_the_date_mp4 · ceremony_program ·
--                                  place_card · menu_card · stationery_signage ·
--                                  souvenirs_giveaways · pasalubong_box ·
--                                  sponsor_token · godchild_token
--   Travel & honeymoon (3):        honeymoon_planner ·
--                                  destination_wedding_travel_coordinator ·
--                                  visa_wedding_logistics
--
-- PH-cultural depth: officiants split by canonical PH faith (Catholic priest
-- vs INC minister vs Muslim imam vs cultural tribal elder), Filipino pre-
-- marriage seminars (pre-cana / CFO) get government-recognition flags,
-- sponsor coordination + pamamanhikan + despedida explicit, sponsor_token /
-- godchild_token / pasalubong_box honor PH gift-giving traditions.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ============================================================================
-- CEREMONY OFFICIANTS
-- ============================================================================

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "archdiocese_assigned":          { "type": "text_short", "label": "Archdiocese assigned" },
    "languages_offered":             { "type": "multi_select", "label": "Languages", "options": ["latin", "english", "tagalog", "cebuano"] },
    "pre_cana_required":             { "type": "boolean", "label": "Pre-cana seminar required" },
    "parish_membership_required":    { "type": "boolean", "label": "Parish membership required" },
    "marriage_license_filing_handled": { "type": "boolean", "label": "Marriage license filing handled by office" },
    "ceremony_duration_hours":       { "type": "int", "label": "Ceremony duration (hours)" }
  }
  $json$::jsonb,
  filter_facets = $json$["languages_offered", "pre_cana_required", "parish_membership_required", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["archdiocese_assigned", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'catholic_priest';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "rtc_assigned":                  { "type": "text_short", "label": "Regional Trial Court assigned" },
    "jurisdiction_areas":            { "type": "multi_select_open", "label": "Jurisdiction areas" },
    "weekend_ceremonies_capable":    { "type": "boolean", "label": "Weekend ceremonies capable" },
    "marriage_license_filing":       { "type": "boolean", "label": "Marriage license filing handled" },
    "ceremony_styles":               { "type": "multi_select", "label": "Ceremony styles", "options": ["chambers_intimate", "courthouse_formal", "off_site_courtroom"] }
  }
  $json$::jsonb,
  filter_facets = $json$["jurisdiction_areas", "weekend_ceremonies_capable", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["rtc_assigned", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'civil_judge';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "municipality_jurisdictions":    { "type": "multi_select_open", "label": "Municipality jurisdictions" },
    "mass_wedding_capable":          { "type": "boolean", "label": "Mass-wedding ceremony capable" },
    "weekend_ceremonies":            { "type": "boolean", "label": "Weekend ceremonies" },
    "additional_fees_handled":       { "type": "boolean", "label": "Additional fees coordination handled" },
    "ceremony_locations":            { "type": "multi_select", "label": "Ceremony locations", "options": ["city_hall", "off_site_couples_venue"] }
  }
  $json$::jsonb,
  filter_facets = $json$["municipality_jurisdictions", "mass_wedding_capable", "ceremony_locations", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["municipality_jurisdictions", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'civil_mayor';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "small_town_jurisdictions":      { "type": "multi_select_open", "label": "Small town jurisdictions" },
    "ceremony_styles":               { "type": "multi_select", "label": "Ceremony styles", "options": ["traditional_civil", "ceremonial_with_speech", "minimal_under_15_min"] },
    "weekend_ceremonies":            { "type": "boolean", "label": "Weekend ceremonies capable" }
  }
  $json$::jsonb,
  filter_facets = $json$["small_town_jurisdictions", "ceremony_styles", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["small_town_jurisdictions", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'civil_justice_of_peace';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "locale_assigned":               { "type": "text_short", "label": "INC Locale assigned" },
    "ceremony_protocol_strict":      { "type": "boolean", "label": "Strict INC ceremony protocol (no alcohol / no dance after)" },
    "no_alcohol_no_dance_compliant": { "type": "boolean", "label": "No-alcohol / no-dance reception compliant" },
    "languages_offered":             { "type": "multi_select", "label": "Languages", "options": ["english", "tagalog", "cebuano"] }
  }
  $json$::jsonb,
  filter_facets = $json$["locale_assigned", "ceremony_protocol_strict", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["locale_assigned", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'inc_minister';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "church_affiliation":            { "type": "text_short", "label": "Church / fellowship affiliation" },
    "ceremony_styles":               { "type": "multi_select", "label": "Ceremony styles", "options": ["traditional", "contemporary_worship", "interactive_modern"] },
    "music_recommendations":         { "type": "boolean", "label": "Provides music recommendations" },
    "couple_counseling_included":    { "type": "boolean", "label": "Pre-marriage couple counseling included" }
  }
  $json$::jsonb,
  filter_facets = $json$["ceremony_styles", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["church_affiliation", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'born_again_pastor';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "church_affiliation":            { "type": "enum", "label": "Church affiliation", "options": ["jil", "ccf", "victory", "every_nation", "other_charismatic"] },
    "interactive_style":             { "type": "boolean", "label": "Interactive / dynamic ceremony style" },
    "music_modern":                  { "type": "boolean", "label": "Modern worship music welcome" },
    "couple_counseling_included":    { "type": "boolean", "label": "Pre-marriage couple counseling included" }
  }
  $json$::jsonb,
  filter_facets = $json$["church_affiliation", "interactive_style", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["church_affiliation", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'charismatic_pastor';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "denomination":                  { "type": "enum", "label": "Denomination", "options": ["baptist", "methodist", "anglican", "lutheran", "presbyterian"] },
    "traditional_liturgy_followed":  { "type": "boolean", "label": "Traditional liturgy followed" },
    "languages_offered":             { "type": "multi_select", "label": "Languages", "options": ["english", "tagalog"] },
    "couple_counseling_included":    { "type": "boolean", "label": "Pre-marriage couple counseling included" }
  }
  $json$::jsonb,
  filter_facets = $json$["denomination", "traditional_liturgy_followed", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["denomination", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'mainline_protestant_pastor';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "bma_registered":                { "type": "boolean", "label": "BMA (Bureau of Muslim Affairs) registered", "required": true },
    "marriage_contract_witnesses":   { "type": "boolean", "label": "Marriage contract witnesses arranged" },
    "masjid_assigned":               { "type": "text_short", "label": "Masjid assigned" },
    "languages":                     { "type": "multi_select", "label": "Languages", "options": ["arabic", "tagalog", "maranao", "tausug", "english"] },
    "mahr_facilitation":             { "type": "boolean", "label": "Mahr facilitation" },
    "ceremony_style":                { "type": "enum", "label": "Ceremony style", "options": ["traditional_islamic", "modernized_with_recitation", "fully_arabic"] }
  }
  $json$::jsonb,
  filter_facets = $json$["bma_registered", "languages", "mahr_facilitation", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["bma_registered", "masjid_assigned", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'muslim_imam';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "tribe_specific":                { "type": "text_short", "label": "Tribe / community", "required": true },
    "ceremony_dialect":              { "type": "multi_select_open", "label": "Ceremony dialect / language" },
    "traditional_oath_protocol":     { "type": "boolean", "label": "Traditional oath protocol observed" },
    "cultural_attire_required":      { "type": "boolean", "label": "Cultural attire required for couple" },
    "ritual_components":             { "type": "multi_select_open", "label": "Ritual components included" }
  }
  $json$::jsonb,
  filter_facets = $json$["tribe_specific", "traditional_oath_protocol", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["tribe_specific", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'cultural_tribal_elder';

-- ============================================================================
-- PRE-MARRIAGE REQUIREMENTS
-- ============================================================================

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "archdiocesan_authorized":       { "type": "boolean", "label": "Archdiocesan authorized facilitator", "required": true },
    "certificate_issued":            { "type": "boolean", "label": "Certificate issued (church-recognized)" },
    "duration_hours":                { "type": "int", "label": "Seminar duration (hours)" },
    "format":                        { "type": "enum", "label": "Format", "options": ["in_person_classroom", "online_zoom", "hybrid"] },
    "languages":                     { "type": "multi_select", "label": "Languages", "options": ["english", "tagalog", "cebuano"] }
  }
  $json$::jsonb,
  filter_facets = $json$["archdiocesan_authorized", "format", "languages", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["archdiocesan_authorized", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'pre_cana_seminar';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "cfo_branch":                    { "type": "text_short", "label": "CFO branch", "required": true },
    "certificate_processing_days":   { "type": "int", "label": "Certificate processing time (days)" },
    "online_capable":                { "type": "boolean", "label": "Online seminar capable" },
    "fil_foreigner_specialist":      { "type": "boolean", "label": "Filipino-foreigner couple specialist" },
    "languages":                     { "type": "multi_select", "label": "Languages", "options": ["english", "tagalog"] }
  }
  $json$::jsonb,
  filter_facets = $json$["cfo_branch", "online_capable", "fil_foreigner_specialist", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["cfo_branch", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'cfo_seminar';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "locale_assigned":               { "type": "text_short", "label": "INC Locale assigned" },
    "sessions_required":             { "type": "int", "label": "Sessions required" },
    "certificate_issued":            { "type": "boolean", "label": "Certificate issued (INC-recognized)" }
  }
  $json$::jsonb,
  filter_facets = $json$["locale_assigned", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["locale_assigned", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'inc_counseling';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "imam_partnership":              { "type": "boolean", "label": "Partner imam-recognized" },
    "sessions_required":             { "type": "int", "label": "Sessions required" },
    "languages":                     { "type": "multi_select", "label": "Languages", "options": ["arabic", "tagalog", "maranao", "tausug", "english"] }
  }
  $json$::jsonb,
  filter_facets = $json$["imam_partnership", "languages", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["imam_partnership", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'muslim_pre_wedding_counseling';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "psa_lto_partnership":           { "type": "boolean", "label": "PSA/LTO process partnership" },
    "processing_days":               { "type": "int", "label": "Typical processing time (days)" },
    "requirements_checklist_assist": { "type": "boolean", "label": "Document checklist assistance" },
    "online_application_capable":    { "type": "boolean", "label": "Online application capable" }
  }
  $json$::jsonb,
  filter_facets = $json$["psa_lto_partnership", "online_application_capable", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'marriage_license_expediting';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "dfa_office_locations":          { "type": "multi_select_open", "label": "DFA office locations served" },
    "document_types_handled":        { "type": "multi_select", "label": "Document types", "options": ["birth_certificate", "marriage_certificate", "cenomar", "academic_records", "police_clearance"] },
    "processing_days":               { "type": "int", "label": "Typical processing time (days)" },
    "expedited_service_capable":     { "type": "boolean", "label": "Expedited service capable" }
  }
  $json$::jsonb,
  filter_facets = $json$["dfa_office_locations", "document_types_handled", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["dfa_office_locations", "document_types_handled"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'apostille_dfa_authentication';

-- ============================================================================
-- PLANNING & COORDINATION
-- ============================================================================

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "services_offered":              { "type": "multi_select", "label": "Services offered", "options": ["month_of_4_weeks", "three_month", "six_month", "year_long_partial"], "required": true },
    "event_size_capability":         { "type": "enum", "label": "Event size capability", "options": ["intimate_under_100", "standard_100_to_300", "grand_300plus"] },
    "team_size":                     { "type": "int", "label": "Team size" },
    "ceremony_reception_coverage":   { "type": "boolean", "label": "Ceremony + reception coverage included" }
  }
  $json$::jsonb,
  filter_facets = $json$["services_offered", "event_size_capability", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["services_offered", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'wedding_planner_partial';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "team_size_typical":             { "type": "int", "label": "Typical team size on-site" },
    "ceremony_reception_coverage":   { "type": "boolean", "label": "Ceremony + reception coverage" },
    "hours_coverage_typical":        { "type": "int", "label": "Typical coverage hours" },
    "includes_dry_run_rehearsal":    { "type": "boolean", "label": "Includes dry-run / rehearsal" },
    "vendor_coordination_pre_event": { "type": "boolean", "label": "Pre-event vendor confirmation handled" }
  }
  $json$::jsonb,
  filter_facets = $json$["team_size_typical", "hours_coverage_typical", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["team_size_typical", "hours_coverage_typical", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'day_of_coordinator';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "countries_handled":             { "type": "multi_select_open", "label": "Countries handled (e.g., Bali, Boracay, Tokyo)" },
    "full_service_or_coordination_only": { "type": "enum", "label": "Service model", "options": ["full_service_planning", "coordination_only", "both"] },
    "accommodation_block_negotiation": { "type": "boolean", "label": "Accommodation block negotiation" },
    "transfer_logistics_handled":    { "type": "boolean", "label": "Guest transfer logistics handled" },
    "minimum_guest_count":           { "type": "int", "label": "Minimum guest count" }
  }
  $json$::jsonb,
  filter_facets = $json$["countries_handled", "full_service_or_coordination_only", "starting_price_centavos"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["countries_handled", "full_service_or_coordination_only"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'destination_wedding_specialist';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "formal_meeting_protocol":       { "type": "boolean", "label": "Formal meeting protocol guidance" },
    "ninang_ninong_coordination":    { "type": "boolean", "label": "Ninang/ninong coordination handled" },
    "gift_protocol_guidance":        { "type": "boolean", "label": "Gift protocol guidance" },
    "venue_options":                 { "type": "multi_select", "label": "Venue options", "options": ["family_home", "restaurant", "private_function_room"] }
  }
  $json$::jsonb,
  filter_facets = $json$["venue_options", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'pamamanhikan_coordinator';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "farewell_party_style":          { "type": "multi_select", "label": "Farewell party style", "options": ["intimate_family", "friends_party", "mixed_celebration"] },
    "family_intimate_or_full_event": { "type": "enum", "label": "Scale", "options": ["intimate_under_30", "medium_30_to_80", "full_event_80plus"] },
    "themed_options":                { "type": "boolean", "label": "Themed package options" }
  }
  $json$::jsonb,
  filter_facets = $json$["farewell_party_style", "family_intimate_or_full_event", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["farewell_party_style", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'despedida_planner';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "ninong_ninang_count_handled":   { "type": "int", "label": "Typical ninong/ninang count handled" },
    "sponsor_attire_coordination":   { "type": "boolean", "label": "Sponsor attire coordination help" },
    "gift_distribution_handled":     { "type": "boolean", "label": "Gift distribution handled" },
    "sponsor_kits_provided":         { "type": "boolean", "label": "Sponsor kits provided" }
  }
  $json$::jsonb,
  filter_facets = $json$["ninong_ninang_count_handled", "sponsor_attire_coordination", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'sponsor_coordinator';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "segregated_table_seating_design": { "type": "boolean", "label": "Segregated table-seating design" },
    "dual_program_running":          { "type": "boolean", "label": "Dual program (men's side / women's side) running" },
    "attire_modesty_consultation":   { "type": "boolean", "label": "Attire modesty consultation" },
    "halal_food_coordination":       { "type": "boolean", "label": "Halal food coordination with caterer" }
  }
  $json$::jsonb,
  filter_facets = $json$["dual_program_running", "halal_food_coordination", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'gender_separated_reception_coordinator';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "venue_types":                   { "type": "multi_select", "label": "Venue types", "options": ["catholic_church", "mosque", "inc_tabernakulo", "born_again_church", "civil_registrar_office"], "required": true },
    "pre_ceremony_coordination":     { "type": "boolean", "label": "Pre-ceremony coordination handled" },
    "ceremony_flow_management":      { "type": "boolean", "label": "Ceremony flow / cue management" }
  }
  $json$::jsonb,
  filter_facets = $json$["venue_types", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["venue_types", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'religious_venue_coordinator';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "inc_protocol_strict":           { "type": "boolean", "label": "Strict INC protocol observed" },
    "no_alcohol_no_dance_compliant_flow": { "type": "boolean", "label": "No-alcohol / no-dance reception flow" },
    "locale_partnerships":           { "type": "multi_select_open", "label": "INC locale partnerships" }
  }
  $json$::jsonb,
  filter_facets = $json$["inc_protocol_strict", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["inc_protocol_strict", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'inc_wedding_coordinator';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "mahr_consultation":             { "type": "boolean", "label": "Mahr consultation included" },
    "marriage_contract_assistance":  { "type": "boolean", "label": "Marriage contract drafting assistance" },
    "witness_coordination":          { "type": "boolean", "label": "Witness coordination handled" },
    "languages":                     { "type": "multi_select", "label": "Languages", "options": ["arabic", "tagalog", "maranao", "english"] }
  }
  $json$::jsonb,
  filter_facets = $json$["mahr_consultation", "languages", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["mahr_consultation", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'mahr_coordination';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "nine_step_roadmap_included":    { "type": "boolean", "label": "9-step planning roadmap included" },
    "vendor_matching_priority":      { "type": "boolean", "label": "Vendor matching priority queue" },
    "daily_nudges":                  { "type": "boolean", "label": "Daily planning nudges" },
    "paid_tier_only":                { "type": "boolean", "label": "Paid tier (₱2,499) — 3-day trial available" },
    "couple_dashboard_integration":  { "type": "boolean", "label": "Couple dashboard integration" }
  }
  $json$::jsonb,
  filter_facets = $json$["paid_tier_only", "vendor_matching_priority"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["nine_step_roadmap_included"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'setnayan_concierge';

-- ============================================================================
-- TRANSPORTATION
-- ============================================================================

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "vehicle_styles":                { "type": "multi_select", "label": "Vehicle styles", "options": ["60s_classic", "70s_muscle", "80s_classic", "vintage_pre_war", "luxury_executive"], "required": true },
    "photography_friendly_styling":  { "type": "boolean", "label": "Photography-friendly styling (preserved interiors / paint)" },
    "specific_vehicles_listed_count": { "type": "int", "min": 1, "label": "Specific vehicles listed (at least 1)" }
  }
  $json$::jsonb,
  filter_facets = $json$["vehicle_styles", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["vehicle_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'vintage_classic_vehicle';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "capacity_per_vehicle":          { "type": "multi_select", "label": "Capacity per vehicle", "options": ["12_pax_van", "24_pax_minibus", "48_pax_bus", "56_pax_coaster"] },
    "pickup_drop_off_routing":       { "type": "boolean", "label": "Pickup / drop-off routing handled" },
    "driver_attire":                 { "type": "multi_select", "label": "Driver attire", "options": ["uniformed", "formal_suit", "casual"] }
  }
  $json$::jsonb,
  filter_facets = $json$["capacity_per_vehicle", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["capacity_per_vehicle", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'transportation_guest_shuttle';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "rider_count":                   { "type": "int", "label": "Rider count" },
    "formation_style":               { "type": "enum", "label": "Formation style", "options": ["parade", "escort", "police_style", "ceremonial_diamond"] },
    "escort_duration_hours":         { "type": "int", "label": "Escort duration (hours)" },
    "permit_handled":                { "type": "boolean", "label": "MMDA / city permit handled" }
  }
  $json$::jsonb,
  filter_facets = $json$["formation_style", "rider_count", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["formation_style", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'motorcycle_escort';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "carriage_styles":               { "type": "multi_select", "label": "Carriage styles", "options": ["cinderella_glass", "victorian_classic", "modern_decorative", "minimal_white"] },
    "horse_temperament_documented":  { "type": "boolean", "label": "Horse temperament documented" },
    "journey_distance_max_km":       { "type": "int", "label": "Maximum journey distance (km)" },
    "permit_handled":                { "type": "boolean", "label": "City / route permit handled" }
  }
  $json$::jsonb,
  filter_facets = $json$["carriage_styles", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["carriage_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'horse_drawn_carriage';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "vessel_size_passenger_count":   { "type": "int", "label": "Passenger capacity" },
    "ceremony_at_sea_capable":       { "type": "boolean", "label": "Ceremony-at-sea capable" },
    "harbor_locations":              { "type": "multi_select_open", "label": "Harbor / departure locations" },
    "duration_hours_max":            { "type": "int", "label": "Maximum journey duration (hours)" },
    "catering_on_board":             { "type": "boolean", "label": "Catering on-board capable" }
  }
  $json$::jsonb,
  filter_facets = $json$["ceremony_at_sea_capable", "vessel_size_passenger_count", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["vessel_size_passenger_count", "harbor_locations"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'bridal_boat_yacht';

-- ============================================================================
-- LOGISTICS & INFRASTRUCTURE
-- ============================================================================

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "power_output_kva":              { "type": "int", "label": "Power output (kVA)" },
    "fuel_type":                     { "type": "enum", "label": "Fuel type", "options": ["diesel", "gasoline", "lpg"] },
    "noise_dampened":                { "type": "boolean", "label": "Noise-dampened (event-grade)" },
    "auto_switchover":               { "type": "boolean", "label": "Auto switchover (UPS-style)" }
  }
  $json$::jsonb,
  filter_facets = $json$["power_output_kva", "noise_dampened", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["power_output_kva", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'generator_rental';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "tent_styles":                   { "type": "multi_select", "label": "Tent styles", "options": ["party_marquee", "sailcloth", "clear_top_glass", "stretch_tent"] },
    "sqm_coverage":                  { "type": "int", "label": "Square meters coverage" },
    "weather_resistance":            { "type": "enum", "label": "Weather resistance", "options": ["light_drizzle", "moderate_rain", "typhoon_grade"] }
  }
  $json$::jsonb,
  filter_facets = $json$["tent_styles", "sqm_coverage", "weather_resistance", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["tent_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'tent_rental';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "unit_types":                    { "type": "multi_select", "label": "Unit types", "options": ["basic_portable", "premium_trailer", "luxury_restroom_trailer"], "required": true },
    "capacity_per_unit":             { "type": "int", "label": "Capacity per unit" },
    "attendant_included":            { "type": "boolean", "label": "Attendant included" }
  }
  $json$::jsonb,
  filter_facets = $json$["unit_types", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["unit_types", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'mobile_restroom_rental';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "cooling_capacity_sqm":          { "type": "int", "label": "Cooling capacity (sqm)" },
    "water_supply_required":         { "type": "boolean", "label": "Water supply required" },
    "attendant_setup":               { "type": "boolean", "label": "Attendant setup included" }
  }
  $json$::jsonb,
  filter_facets = $json$["cooling_capacity_sqm", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["cooling_capacity_sqm", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'cooling_fans_misters';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "power_output_watts":            { "type": "int", "label": "Power output (watts)" },
    "weather_protection":            { "type": "boolean", "label": "Weather protection" },
    "mixer_engineer_included":       { "type": "boolean", "label": "Mixer / sound engineer included" }
  }
  $json$::jsonb,
  filter_facets = $json$["power_output_watts", "weather_protection", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["power_output_watts", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'outdoor_sound_system';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "lighting_styles":               { "type": "multi_select", "label": "Lighting styles", "options": ["string_lights_classic", "market_lights", "uplighting", "spot_lights", "led_pinspot", "fairy_curtain"] },
    "themed_options":                { "type": "boolean", "label": "Themed package options" }
  }
  $json$::jsonb,
  filter_facets = $json$["lighting_styles", "themed_options", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["lighting_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'outdoor_lighting_specialist';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "protection_radius_meters":      { "type": "int", "label": "Protection radius (meters)" },
    "eco_friendly_options":          { "type": "boolean", "label": "Eco-friendly options" },
    "ongoing_application":           { "type": "boolean", "label": "Ongoing application during event" }
  }
  $json$::jsonb,
  filter_facets = $json$["eco_friendly_options", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'bug_repellent_station';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "real_time_radar_partnership":   { "type": "boolean", "label": "Real-time radar partnership (PAGASA / private)" },
    "contingency_protocol_drafting": { "type": "boolean", "label": "Contingency protocol drafting included" },
    "advance_warning_hours":         { "type": "int", "label": "Advance warning lead time (hours)" }
  }
  $json$::jsonb,
  filter_facets = $json$["real_time_radar_partnership", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'wedding_day_weather_forecaster';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "styles_themed":                 { "type": "multi_select", "label": "Styles themed", "options": ["vintage_parasol", "sun_hats", "wedding_themed", "branded_couple_initials"] },
    "per_guest_pricing":             { "type": "boolean", "label": "Per-guest pricing model" }
  }
  $json$::jsonb,
  filter_facets = $json$["styles_themed", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["styles_themed", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'parasol_hat_rental';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "rooms_handled":                 { "type": "multi_select", "label": "Rooms handled", "options": ["small_intimate", "medium", "grand_ballroom"] },
    "equipment_brands_carried":      { "type": "multi_select_open", "label": "Equipment brands carried" },
    "engineer_included":             { "type": "boolean", "label": "Sound engineer included" },
    "lighting_capable":              { "type": "boolean", "label": "Lighting design capable (in addition to sound)" }
  }
  $json$::jsonb,
  filter_facets = $json$["rooms_handled", "engineer_included", "lighting_capable", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["rooms_handled", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'lights_sound';

-- ============================================================================
-- STATIONERY & KEEPSAKES
-- ============================================================================

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "print_finishes":                { "type": "multi_select", "label": "Print finishes", "options": ["matte", "glossy", "foil_stamping", "embossed", "letterpress", "uv_coating"] },
    "envelope_options":              { "type": "multi_select", "label": "Envelope options", "options": ["plain", "lined", "custom_addressed", "wax_seal"] },
    "custom_design_available":       { "type": "boolean", "label": "Custom design available" },
    "sample_uploads_count":          { "type": "int", "min": 3, "label": "Sample uploads (at least 3)" }
  }
  $json$::jsonb,
  filter_facets = $json$["print_finishes", "envelope_options", "custom_design_available", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["print_finishes", "service_regions"], "minimum_uploads": { "sample_designs": 3 } } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'invitation_print';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "design_software_used":          { "type": "multi_select_open", "label": "Design software used" },
    "embedded_links_capable":        { "type": "multi_select", "label": "Embedded links capable", "options": ["rsvp_form", "maps", "calendar_save", "couple_story_microsite"] },
    "animated_options":              { "type": "boolean", "label": "Animated options" },
    "custom_microsite_capable":      { "type": "boolean", "label": "Custom wedding microsite included" }
  }
  $json$::jsonb,
  filter_facets = $json$["embedded_links_capable", "animated_options", "custom_microsite_capable", "starting_price_centavos"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["embedded_links_capable"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'invitation_digital';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "card_styles":                   { "type": "multi_select", "label": "Card styles", "options": ["classic_traditional", "modern_minimalist", "themed_custom", "filipiniana_native"] },
    "custom_illustration_available": { "type": "boolean", "label": "Custom illustration available" },
    "languages_supported":           { "type": "multi_select", "label": "Languages supported", "options": ["english", "tagalog", "cebuano", "ilocano"] },
    "sample_uploads_count":          { "type": "int", "min": 3, "label": "Sample uploads (at least 3)" }
  }
  $json$::jsonb,
  filter_facets = $json$["card_styles", "custom_illustration_available", "languages_supported", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["card_styles", "service_regions"], "minimum_uploads": { "sample_designs": 3 } } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'wedding_cards_designer';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "format_options":                { "type": "multi_select", "label": "Format options", "options": ["mp4_video", "animated_gif", "static_image", "interactive_microsite"] },
    "shareable_link_capable":        { "type": "boolean", "label": "Shareable link capable" },
    "rsvp_integration":              { "type": "boolean", "label": "RSVP integration" }
  }
  $json$::jsonb,
  filter_facets = $json$["format_options", "rsvp_integration", "starting_price_centavos"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["format_options"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'save_the_date_digital';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "customization_options":         { "type": "multi_select", "label": "Customization options", "options": ["couple_monogram", "themed_template", "custom_music", "couple_photo_embed"] },
    "delivery_format_options":       { "type": "multi_select", "label": "Delivery format", "options": ["mp4_full_hd", "social_optimized_9x16", "instagram_square"] },
    "revisions_included":            { "type": "int", "label": "Revisions included" },
    "delivery_timeline_days":        { "type": "int", "label": "Delivery timeline (days)" }
  }
  $json$::jsonb,
  filter_facets = $json$["customization_options", "delivery_format_options", "starting_price_centavos"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["customization_options"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'setnayan_save_the_date_mp4';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "book_styles":                   { "type": "multi_select", "label": "Book styles", "options": ["single_page", "multi_page_book", "scroll_unique", "trifold"] },
    "print_finishes":                { "type": "multi_select", "label": "Print finishes", "options": ["matte", "glossy", "foil_stamping", "letterpress"] },
    "custom_design_available":       { "type": "boolean", "label": "Custom design available" },
    "languages_supported":           { "type": "multi_select", "label": "Languages", "options": ["english", "tagalog", "latin_catholic", "arabic_islamic"] }
  }
  $json$::jsonb,
  filter_facets = $json$["book_styles", "print_finishes", "languages_supported", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["book_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'ceremony_program';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "card_styles":                   { "type": "multi_select", "label": "Card styles", "options": ["classic_cardstock", "laser_cut", "themed_die_cut", "minimalist", "vintage_calligraphy"] },
    "font_options":                  { "type": "multi_select", "label": "Font options", "options": ["script_calligraphy", "serif_classic", "sans_serif_modern", "handwritten"] },
    "custom_couple_design":          { "type": "boolean", "label": "Custom couple design" }
  }
  $json$::jsonb,
  filter_facets = $json$["card_styles", "font_options", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["card_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'place_card';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "print_finishes":                { "type": "multi_select", "label": "Print finishes", "options": ["matte", "glossy", "foil_stamping", "letterpress", "embossed"] },
    "couple_monogram_capable":       { "type": "boolean", "label": "Couple monogram capable" },
    "languages_supported":           { "type": "multi_select", "label": "Languages", "options": ["english", "tagalog", "spanish_themed"] }
  }
  $json$::jsonb,
  filter_facets = $json$["print_finishes", "languages_supported", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["print_finishes", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'menu_card';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "signage_types":                 { "type": "multi_select", "label": "Signage types", "options": ["welcome_sign", "ceremony_program_board", "seating_chart", "directional", "menu_display", "couple_quote_board"], "required": true },
    "material_options":              { "type": "multi_select", "label": "Material options", "options": ["wood_carved", "acrylic", "canvas", "mirror_engraved", "chalkboard", "metal_laser_cut"] },
    "custom_design_available":       { "type": "boolean", "label": "Custom design available" }
  }
  $json$::jsonb,
  filter_facets = $json$["signage_types", "material_options", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["signage_types", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'stationery_signage';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "souvenir_types":                { "type": "multi_select", "label": "Souvenir types", "options": ["edible_chocolate_jam", "practical_keychain_magnet", "decorative_figurine", "native_filipino_themed", "candle_diy_kit", "succulent_living"], "required": true },
    "custom_branding_capable":       { "type": "boolean", "label": "Custom branding (couple monogram) capable" },
    "minimum_order_quantity":        { "type": "int", "label": "Minimum order quantity" },
    "sample_uploads_count":          { "type": "int", "min": 3, "label": "Sample uploads (at least 3)" }
  }
  $json$::jsonb,
  filter_facets = $json$["souvenir_types", "custom_branding_capable", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["souvenir_types", "service_regions"], "minimum_uploads": { "sample_photos": 3 } } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'souvenirs_giveaways';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "box_types":                     { "type": "multi_select", "label": "Box types", "options": ["traditional_native_woven", "modern_premium", "wooden_keepsake", "minimalist_kraft"], "required": true },
    "filling_options":               { "type": "multi_select", "label": "Filling options", "options": ["filipino_snacks", "regional_specialties", "branded_custom", "premium_imported", "native_delicacies_kakanin"] },
    "custom_branding_capable":       { "type": "boolean", "label": "Custom branding capable" }
  }
  $json$::jsonb,
  filter_facets = $json$["box_types", "filling_options", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["box_types", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'pasalubong_box';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "token_categories":              { "type": "multi_select", "label": "Token categories", "options": ["custom_engraving", "native_pinoy_themed", "themed_couple_branded", "candles_blessed", "framed_keepsake"] },
    "suitable_for":                  { "type": "multi_select", "label": "Suitable for", "options": ["ninong_ninang", "principal_sponsors", "secondary_sponsors", "honorary_guests"] },
    "minimum_order_quantity":        { "type": "int", "label": "Minimum order quantity" }
  }
  $json$::jsonb,
  filter_facets = $json$["token_categories", "suitable_for", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["token_categories", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'sponsor_token';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "token_styles":                  { "type": "multi_select", "label": "Token styles", "options": ["educational_themed", "spiritual_themed", "keepsake_themed", "candy_filled", "stuffed_toy", "personalized_books"] },
    "age_appropriate_categories":    { "type": "multi_select", "label": "Age-appropriate", "options": ["infant_under_2", "toddler_2_to_6", "kids_6_to_12", "teens_12plus"] }
  }
  $json$::jsonb,
  filter_facets = $json$["token_styles", "age_appropriate_categories", "starting_price_centavos", "service_regions"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["token_styles", "service_regions"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'godchild_token';

-- ============================================================================
-- TRAVEL & HONEYMOON
-- ============================================================================

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "destination_specializations":   { "type": "multi_select_open", "label": "Destination specializations" },
    "budget_tier_capable":           { "type": "multi_select", "label": "Budget tiers", "options": ["budget_under_100k", "mid_range_100k_to_300k", "premium_300k_plus", "luxury"] },
    "romance_or_adventure_focus":    { "type": "enum", "label": "Romance or adventure focus", "options": ["romance_only", "adventure_only", "mixed"] },
    "all_inclusive_or_custom":       { "type": "enum", "label": "Package model", "options": ["all_inclusive", "custom_built", "both"] }
  }
  $json$::jsonb,
  filter_facets = $json$["destination_specializations", "budget_tier_capable", "romance_or_adventure_focus", "all_inclusive_or_custom"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["destination_specializations", "budget_tier_capable"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'honeymoon_planner';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "countries_handled":             { "type": "multi_select_open", "label": "Countries handled" },
    "accommodation_block_negotiation": { "type": "boolean", "label": "Accommodation block negotiation" },
    "transfer_logistics":            { "type": "boolean", "label": "Guest transfer logistics" },
    "visa_assistance":               { "type": "boolean", "label": "Visa assistance for guests" }
  }
  $json$::jsonb,
  filter_facets = $json$["countries_handled", "accommodation_block_negotiation", "visa_assistance"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["countries_handled"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'destination_wedding_travel_coordinator';

UPDATE public.canonical_service_schemas SET
  category_specific_attributes = $json$
  {
    "fil_am_couple_specialization":  { "type": "boolean", "label": "Filipino-American couple specialization" },
    "visa_types_handled":            { "type": "multi_select", "label": "Visa types handled", "options": ["k1_fiance", "spouse_visa_cr1", "k3_marriage", "i_130_immigrant_petition"], "required": true },
    "uscis_documentation_assistance": { "type": "boolean", "label": "USCIS documentation assistance" },
    "processing_timeline_months":    { "type": "int", "label": "Typical processing timeline (months)" }
  }
  $json$::jsonb,
  filter_facets = $json$["visa_types_handled", "fil_am_couple_specialization", "uscis_documentation_assistance"]$json$::jsonb,
  required_for_visibility = $json$ { "minimum_fields": ["visa_types_handled"] } $json$::jsonb,
  updated_at = NOW() WHERE canonical_service = 'visa_wedding_logistics';

COMMIT;
