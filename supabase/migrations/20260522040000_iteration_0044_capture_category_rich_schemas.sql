-- ============================================================================
-- 20260522040000_iteration_0044_capture_category_rich_schemas.sql
--
-- Iteration 0044 — Per-category schemas for Column 1 of the master taxonomy
-- (Capture / Visual). 12 canonical_services gain full
-- category_specific_attributes + filter_facets + required_for_visibility,
-- following the same pattern that 20260522020000 (food) +
-- 20260522030000 (music) used.
--
-- photography + videography (PR #167) already have rich schemas — NOT touched.
--
-- Categories enriched here (13):
--   Photographers: pre_nup_photographer · engagement_photographer · drone ·
--     same_day_edit · family_day2_photographer · boudoir_photographer ·
--     studio_portrait_photographer · setnayan_papic
--   Videographers: drone_videographer · highlight_reel_specialist ·
--     setnayan_ai_edited_highlight
--   Pre-Nup Locations (new top-level): pre_nup_shoot_locations
--
-- Visual / media-heavy canonicals: each schema includes
-- `sample_portfolio_urls` (image galleries via Google Drive / Instagram
-- / portfolio site link arrays) and/or `sample_video_urls` (YouTube /
-- Vimeo embeds per the 2026-05-20 showcase-pattern lock). minimum_uploads
-- still applies to image-heavy categories (photographers need photo
-- counts); minimum_sample_video applies to video-heavy categories
-- (drone, SDE, highlight reel, AI edit).
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. pre_nup_photographer — pre-wedding photo session specialist
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "shooting_aesthetic": {
    "type": "multi_select",
    "label": "Shooting aesthetic",
    "options": ["editorial", "lifestyle", "candid_documentary", "fine_art", "journalistic", "posed_classic", "destination_travel"],
    "required": true
  },
  "location_types": {
    "type": "multi_select",
    "label": "Location types",
    "options": ["studio", "outdoor_urban", "beach", "garden", "heritage", "destination", "home_lifestyle"]
  },
  "delivery_format": {
    "type": "multi_select",
    "label": "Delivery format",
    "options": ["edited_jpegs", "raw_files", "photobook_print", "slideshow_video"]
  },
  "session_duration_hours":        { "type": "int", "label": "Session duration (hours)" },
  "couple_outfit_change_count":    { "type": "int", "label": "Outfit changes typical" },
  "includes_pre_consult":          { "type": "boolean", "label": "Pre-shoot consult included" },
  "typical_turnaround_weeks":      { "type": "int", "label": "Turnaround time (weeks)" },
  "past_locations_worked":         { "type": "multi_select_open", "label": "Past locations shot at (add up to 50)" },
  "sample_portfolio_uploads_count": { "type": "int", "min": 10, "label": "Upload at least 10 portfolio photos" }
}
$json$::jsonb,
    filter_facets = $json$["shooting_aesthetic", "location_types", "delivery_format", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["shooting_aesthetic", "service_regions"],
  "minimum_uploads": { "portfolio_photos": 10, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'pre_nup_photographer';

-- ----------------------------------------------------------------------------
-- 2. engagement_photographer — proposal + engagement documentation
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "coverage_type": {
    "type": "multi_select",
    "label": "Coverage type",
    "options": ["proposal_surprise", "pre_engagement_session", "post_engagement_announcement", "all_three"],
    "required": true
  },
  "shooting_style": {
    "type": "enum",
    "label": "Shooting style",
    "options": ["candid_documentary", "posed_classic", "mixed", "cinematic_storytelling"]
  },
  "stealth_proposal_experience":   { "type": "boolean", "label": "Experience with stealth / surprise proposals" },
  "delivery_format": {
    "type": "multi_select",
    "label": "Delivery format",
    "options": ["edited_jpegs", "social_ready_reels", "photobook_print", "slideshow_video"]
  },
  "typical_turnaround_weeks":      { "type": "int", "label": "Turnaround time (weeks)" },
  "sample_portfolio_uploads_count": { "type": "int", "min": 8, "label": "Upload at least 8 portfolio photos" }
}
$json$::jsonb,
    filter_facets = $json$["coverage_type", "shooting_style", "stealth_proposal_experience", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["coverage_type", "service_regions"],
  "minimum_uploads": { "portfolio_photos": 8, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'engagement_photographer';

-- ----------------------------------------------------------------------------
-- 3. drone — drone operator (still photography + aerial)
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "shooting_certifications": {
    "type": "multi_select",
    "label": "Operator certifications",
    "options": ["caap_registered", "faa_part107", "dronesphilippines_certified", "no_certification"]
  },
  "drone_models":                  { "type": "multi_select_open", "label": "Drone models flown" },
  "maximum_altitude_meters":       { "type": "int", "label": "Maximum operational altitude (meters)" },
  "weather_conditions_capable": {
    "type": "multi_select",
    "label": "Weather conditions capable",
    "options": ["calm_sunny", "light_wind", "indoor_capable", "low_light_evening"]
  },
  "aerial_styles": {
    "type": "multi_select",
    "label": "Aerial styles",
    "options": ["cinematic_sweeping", "ceremony_overhead", "group_pull_aways", "reveal_shot", "venue_establishing"],
    "required": true
  },
  "crew_size":                     { "type": "int", "label": "Crew size (1 = solo operator)" },
  "venue_clearance_handled":       { "type": "boolean", "label": "Venue / airspace clearance handled by vendor" },
  "sample_video_urls":             { "type": "multi_select_open", "label": "Sample aerial video URLs (YouTube / Vimeo)" },
  "sample_image_uploads_count":    { "type": "int", "min": 5, "label": "Upload at least 5 aerial photos" }
}
$json$::jsonb,
    filter_facets = $json$["aerial_styles", "shooting_certifications", "weather_conditions_capable", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":      ["aerial_styles", "service_regions"],
  "minimum_uploads":     { "sample_images": 5, "vendor_logo": 1 },
  "minimum_sample_video": 1
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'drone';

-- ----------------------------------------------------------------------------
-- 4. same_day_edit — SDE specialist (delivered same-day at reception)
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "delivery_window_hours":         { "type": "int", "label": "Delivery window (hours after ceremony start)" },
  "video_length_minutes":          { "type": "int", "label": "Video length (minutes)" },
  "editing_style": {
    "type": "multi_select",
    "label": "Editing style",
    "options": ["highlight_montage", "narrative_chronological", "music_video_style", "candid_emotional"],
    "required": true
  },
  "music_sourcing": {
    "type": "enum",
    "label": "Music sourcing",
    "options": ["vendor_provided_licensed", "couple_provided", "both"]
  },
  "live_edit_capable":             { "type": "boolean", "label": "Live editing during reception (vs. studio rush)" },
  "crew_size":                     { "type": "int", "label": "Crew size on-site" },
  "delivery_format": {
    "type": "multi_select",
    "label": "Delivery format",
    "options": ["projection_at_reception", "social_ready_reel", "mp4_couple_archive"]
  },
  "sample_sde_urls":               { "type": "multi_select_open", "label": "Sample SDE URLs (YouTube / Vimeo) — at least 2" }
}
$json$::jsonb,
    filter_facets = $json$["editing_style", "live_edit_capable", "delivery_window_hours", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":      ["editing_style", "delivery_window_hours", "service_regions"],
  "minimum_sample_video": 2
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'same_day_edit';

-- ----------------------------------------------------------------------------
-- 5. family_day2_photographer — day-after brunch + family portraits
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "coverage_type": {
    "type": "multi_select",
    "label": "Coverage type",
    "options": ["day_after_brunch_lifestyle", "family_portrait_session", "casual_recap", "gift_opening_documentation"],
    "required": true
  },
  "session_duration_hours":        { "type": "int", "label": "Session duration (hours)" },
  "includes_print_delivery":       { "type": "boolean", "label": "Includes print delivery (album / wall print)" },
  "delivery_format": {
    "type": "multi_select",
    "label": "Delivery format",
    "options": ["edited_jpegs", "photobook_print", "social_ready_reel", "framed_prints"]
  },
  "sample_portfolio_uploads_count": { "type": "int", "min": 6, "label": "Upload at least 6 portfolio photos" }
}
$json$::jsonb,
    filter_facets = $json$["coverage_type", "session_duration_hours", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["coverage_type", "service_regions"],
  "minimum_uploads": { "portfolio_photos": 6, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'family_day2_photographer';

-- ----------------------------------------------------------------------------
-- 6. boudoir_photographer — intimate / artistic bridal portraits
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "session_style": {
    "type": "multi_select",
    "label": "Session style",
    "options": ["classic_glamour", "contemporary_artistic", "intimate_lifestyle", "beach_destination", "studio_dramatic"],
    "required": true
  },
  "coverage_setting": {
    "type": "enum",
    "label": "Coverage setting",
    "options": ["studio_only", "on_location", "both"]
  },
  "session_duration_hours":        { "type": "int", "label": "Session duration (hours)" },
  "wardrobe_consultation_included": { "type": "boolean", "label": "Wardrobe consultation included" },
  "hmua_referral_available":       { "type": "boolean", "label": "HMUA referral / package available" },
  "privacy_handling": {
    "type": "enum",
    "label": "Privacy handling",
    "options": ["confidential_no_marketing_use", "opt_in_marketing_use", "vendor_curated_anonymous_marketing"]
  },
  "sample_portfolio_uploads_count": { "type": "int", "min": 6, "label": "Upload at least 6 portfolio photos (curated; respects privacy)" }
}
$json$::jsonb,
    filter_facets = $json$["session_style", "coverage_setting", "privacy_handling", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["session_style", "privacy_handling", "service_regions"],
  "minimum_uploads": { "portfolio_photos": 6, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'boudoir_photographer';

-- ----------------------------------------------------------------------------
-- 7. studio_portrait_photographer — formal couple / family portraits
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "studio_locations":              { "type": "multi_select_open", "label": "Studio locations" },
  "backdrop_options": {
    "type": "multi_select",
    "label": "Backdrop options",
    "options": ["neutral_white", "neutral_grey", "traditional_colored", "themed_custom", "vintage_classical"]
  },
  "group_sizes_capable": {
    "type": "multi_select",
    "label": "Group sizes capable",
    "options": ["individual", "couple", "family_4_to_8", "large_group_8plus"]
  },
  "lighting_style": {
    "type": "multi_select",
    "label": "Lighting style",
    "options": ["natural_window", "studio_softbox", "dramatic_high_contrast", "vintage_warm"]
  },
  "session_duration_hours":        { "type": "int", "label": "Session duration (hours)" },
  "includes_outfit_changes":       { "type": "boolean", "label": "Outfit changes accommodated" },
  "sample_portfolio_uploads_count": { "type": "int", "min": 8, "label": "Upload at least 8 portfolio photos" }
}
$json$::jsonb,
    filter_facets = $json$["backdrop_options", "group_sizes_capable", "lighting_style", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["backdrop_options", "group_sizes_capable", "service_regions"],
  "minimum_uploads": { "portfolio_photos": 8, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'studio_portrait_photographer';

-- ----------------------------------------------------------------------------
-- 8. setnayan_papic — Setnayan first-party crowd-photo capture
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "coverage_modes": {
    "type": "multi_select",
    "label": "Coverage modes",
    "options": ["photographer_initiated_album", "candid_papic_capture", "both"]
  },
  "delivery_format": {
    "type": "multi_select",
    "label": "Delivery format",
    "options": ["in_app_gallery", "drive_sync", "downloadable_archive", "shareable_link"]
  },
  "expected_photo_count_min":      { "type": "int", "label": "Expected photo count minimum" },
  "ai_face_detection_for_couple":  { "type": "boolean", "label": "AI face-detection for couple-centric sorting" },
  "sample_album_urls":             { "type": "multi_select_open", "label": "Sample album URLs (in-app demo links)" }
}
$json$::jsonb,
    filter_facets = $json$["coverage_modes", "delivery_format", "expected_photo_count_min", "starting_price_centavos"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields": ["coverage_modes", "delivery_format"]
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'setnayan_papic';

-- ----------------------------------------------------------------------------
-- 9. drone_videographer — aerial videography (cinematic motion)
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "drone_certifications": {
    "type": "multi_select",
    "label": "Drone certifications",
    "options": ["caap_registered", "faa_part107", "dronesphilippines_certified", "no_certification"]
  },
  "aerial_styles": {
    "type": "multi_select",
    "label": "Aerial videography styles",
    "options": ["cinematic_sweeping", "ceremony_overhead", "group_pull_aways", "reveal_shot", "slow_motion", "follow_subject_dynamic"],
    "required": true
  },
  "video_length_minutes":          { "type": "int", "label": "Video length (minutes)" },
  "edit_style": {
    "type": "multi_select",
    "label": "Edit style",
    "options": ["highlight_focused", "full_narrative", "social_reels", "music_video_style"]
  },
  "weather_conditions_capable": {
    "type": "multi_select",
    "label": "Weather conditions capable",
    "options": ["calm_sunny", "light_wind", "low_light_evening"]
  },
  "venue_clearance_handled":       { "type": "boolean", "label": "Venue / airspace clearance handled by vendor" },
  "sample_video_urls":             { "type": "multi_select_open", "label": "Sample aerial video URLs (YouTube / Vimeo) — at least 2" }
}
$json$::jsonb,
    filter_facets = $json$["aerial_styles", "edit_style", "drone_certifications", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":      ["aerial_styles", "service_regions"],
  "minimum_sample_video": 2
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'drone_videographer';

-- ----------------------------------------------------------------------------
-- 10. highlight_reel_specialist — short-form social-ready cuts
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "reel_length_seconds":           { "type": "int", "label": "Reel length (seconds)" },
  "music_selection_responsibility": {
    "type": "enum",
    "label": "Music selection responsibility",
    "options": ["vendor_curated", "couple_provided", "both"]
  },
  "editing_style": {
    "type": "multi_select",
    "label": "Editing style",
    "options": ["cinematic_montage", "candid_documentary", "narrative_chronological", "music_video_style", "energetic_party"],
    "required": true
  },
  "delivery_resolutions": {
    "type": "multi_select",
    "label": "Delivery resolutions",
    "options": ["1080p", "4k", "social_media_optimized_9x16", "instagram_square"]
  },
  "delivery_timeline_weeks":       { "type": "int", "label": "Delivery timeline (weeks)" },
  "sample_video_urls":             { "type": "multi_select_open", "label": "Sample highlight reel URLs (YouTube / Vimeo) — at least 3" }
}
$json$::jsonb,
    filter_facets = $json$["editing_style", "reel_length_seconds", "delivery_timeline_weeks", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":      ["editing_style", "service_regions"],
  "minimum_sample_video": 3
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'highlight_reel_specialist';

-- ----------------------------------------------------------------------------
-- 11. setnayan_ai_edited_highlight — Setnayan first-party AI montage
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "ai_capability_features": {
    "type": "multi_select",
    "label": "AI capability features",
    "options": ["auto_moment_detection", "face_detection_couple_centric", "smart_music_matching", "scene_categorization", "color_grade_auto"]
  },
  "delivery_timeline_hours":       { "type": "int", "label": "Delivery timeline (hours)" },
  "ai_editing_models_available": {
    "type": "multi_select",
    "label": "AI editing models available",
    "options": ["casual_montage", "romantic_montage", "traditional_filipino_montage", "high_energy_reception"]
  },
  "raw_footage_required":          { "type": "boolean", "label": "Raw footage required (vs. edited input)" },
  "human_review_pass_included":    { "type": "boolean", "label": "Human review / polish pass included" },
  "sample_output_urls":            { "type": "multi_select_open", "label": "Sample AI-edited output URLs (YouTube / Vimeo)" }
}
$json$::jsonb,
    filter_facets = $json$["ai_capability_features", "delivery_timeline_hours", "ai_editing_models_available", "starting_price_centavos"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields": ["ai_capability_features", "delivery_timeline_hours"]
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'setnayan_ai_edited_highlight';

-- ----------------------------------------------------------------------------
-- 12. pre_nup_shoot_locations — bookable LOCATION (not vendor) for pre-nup shoots
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "location_types": {
    "type": "multi_select",
    "label": "Location types",
    "options": ["beach", "mountains", "forest", "heritage_house", "urban_warehouse", "garden_estate", "coastal_cliff", "historical_landmark", "rice_terraces", "infinity_pool"],
    "required": true
  },
  "ph_region": {
    "type": "text_short",
    "label": "PH region / city (e.g., El Nido, Tagaytay, Siargao, Vigan)"
  },
  "accessibility": {
    "type": "enum",
    "label": "Accessibility",
    "options": ["drive_in_easy", "drive_in_difficult", "requires_hike", "requires_boat", "private_road"]
  },
  "shoot_duration_options": {
    "type": "multi_select",
    "label": "Shoot duration options",
    "options": ["half_day_4hr", "full_day_8hr", "weekend_extended", "golden_hour_only"]
  },
  "exclusivity_options": {
    "type": "enum",
    "label": "Exclusivity options",
    "options": ["private_booking_available", "public_shared_only", "both"]
  },
  "best_seasons": {
    "type": "multi_select",
    "label": "Best seasons for shoots",
    "options": ["dry_dec_to_may", "wet_jun_to_nov", "year_round", "harvest_season_only"]
  },
  "accommodation_nearby":          { "type": "boolean", "label": "Accommodation nearby (within 30 min)" },
  "gallery_image_uploads_count":   { "type": "int", "min": 5, "label": "Upload at least 5 location gallery photos" }
}
$json$::jsonb,
    filter_facets = $json$["location_types", "accessibility", "best_seasons", "exclusivity_options", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":  ["location_types", "ph_region", "accessibility", "service_regions"],
  "minimum_uploads": { "gallery_images": 5, "vendor_logo": 1 }
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'pre_nup_shoot_locations';

COMMIT;
