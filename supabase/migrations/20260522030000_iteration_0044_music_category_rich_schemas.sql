-- ============================================================================
-- 20260522030000_iteration_0044_music_category_rich_schemas.sql
--
-- Iteration 0044 — Per-category schemas for Column 2 of the master taxonomy
-- (Music & Entertainment). 14 canonical_services gain full
-- category_specific_attributes + filter_facets + required_for_visibility,
-- following the same pattern that 20260522020000 used for food.
--
-- band_live_music (unified ensemble schema from PR #167) + host_emcee
-- (PR #167) already have rich schemas — NOT touched.
--
-- Categories enriched here:
--   Bands & ensembles (V1.1.3): live_band · acoustic_performer ·
--     choir_string_quartet · wedding_singer
--   Cultural ensembles (V1.4 / V1.5+): kulintang_ensemble (Muslim) ·
--     rondalla_ensemble · folk_performer
--   Setnayan first-party (V1.1 base): setnayan_pakanta · setnayan_panood
--   DJs & Entertainment (V1.1.3): dj · wedding_entertainment
--   Choreographers (V1.2): entourage_choreographer · first_dance_choreographer
--     · pre_cana_dance_trainer
--
-- Sample audio/video lives as YouTube/Vimeo URL arrays
-- (`sample_audio_urls` / `sample_video_urls`) per the 2026-05-20 showcase-
-- pattern lock — composable client primitives (<AudioGallery>, <VideoEmbed>)
-- consume these arrays. R2 paid storage option was declined in favor of
-- embed simplicity + zero per-GB cost.
--
-- shared_attribute_groups inheritance unchanged from 20260521040000
-- (geographic_service_areas + pricing_signal + vendor_credentials).
--
-- Idempotent — UPDATE statements land at the same final values regardless
-- of prior content.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. live_band — full wedding band ensemble
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "ensemble_size": {
    "type": "enum",
    "label": "Ensemble size",
    "options": ["trio", "quartet", "quintet", "full_band_6plus"],
    "required": true
  },
  "genres": {
    "type": "multi_select",
    "label": "Genres",
    "options": ["opm", "pop", "jazz", "standards", "acoustic", "rock", "classical", "kundiman", "folk_pinoy", "contemporary_christian", "broadway", "rnb_soul"],
    "required": true
  },
  "ceremony_ready":             { "type": "boolean", "label": "Ceremony-ready" },
  "reception_ready":            { "type": "boolean", "label": "Reception-ready" },
  "accepts_song_requests":      { "type": "enum", "label": "Accepts song requests", "options": ["yes_any", "yes_from_pre_approved_list", "no"] },
  "song_catalog_count":         { "type": "int", "min": 30, "label": "Song catalog count (at least 30)" },
  "instruments_brought":        { "type": "multi_select_open", "label": "Instruments brought" },
  "sound_system_provided":      { "type": "boolean", "label": "Sound system provided" },
  "religious_repertoire_available": {
    "type": "multi_select",
    "label": "Religious repertoire available",
    "options": ["catholic_liturgical", "inc_acceptable", "christian_worship", "muslim_acceptable", "secular_only"]
  },
  "sample_audio_urls":          { "type": "multi_select_open", "label": "Sample audio URLs (YouTube / Vimeo) — at least 3" },
  "sample_video_urls":          { "type": "multi_select_open", "label": "Sample video URLs (YouTube / Vimeo)" }
}
$json$::jsonb,
    filter_facets = $json$["ensemble_size", "genres", "ceremony_ready", "reception_ready", "religious_repertoire_available", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":      ["ensemble_size", "genres", "service_regions"],
  "minimum_sample_audio": 3
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'live_band';

-- ----------------------------------------------------------------------------
-- 2. acoustic_performer — solo / duo acoustic
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "configuration": {
    "type": "enum",
    "label": "Configuration",
    "options": ["solo_male", "solo_female", "duo_mixed", "duo_male", "duo_female"],
    "required": true
  },
  "voice_range": {
    "type": "multi_select",
    "label": "Voice range",
    "options": ["soprano", "mezzo_soprano", "alto", "tenor", "baritone", "bass"]
  },
  "instruments": {
    "type": "multi_select",
    "label": "Instruments played",
    "options": ["acoustic_guitar", "classical_guitar", "piano", "violin", "cello", "ukulele", "harp"]
  },
  "genres": {
    "type": "multi_select",
    "label": "Genres",
    "options": ["opm_acoustic", "pop_acoustic", "classical", "kundiman", "contemporary_worship", "jazz_standards"],
    "required": true
  },
  "languages_offered": {
    "type": "multi_select",
    "label": "Languages offered",
    "options": ["english", "tagalog", "spanish", "italian"]
  },
  "typical_set_duration_minutes": { "type": "int", "label": "Typical set duration (minutes)" },
  "ceremony_processional_ready":  { "type": "boolean", "label": "Ceremony / processional ready" },
  "accepts_couple_song_request":  { "type": "boolean", "label": "Accepts couple-song custom learning" },
  "sample_audio_urls":            { "type": "multi_select_open", "label": "Sample audio URLs (YouTube / Vimeo) — at least 2" }
}
$json$::jsonb,
    filter_facets = $json$["configuration", "genres", "voice_range", "ceremony_processional_ready", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":      ["configuration", "genres", "service_regions"],
  "minimum_sample_audio": 2
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'acoustic_performer';

-- ----------------------------------------------------------------------------
-- 3. choir_string_quartet — ceremonial vocal / string ensemble
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "ensemble_type": {
    "type": "enum",
    "label": "Ensemble type",
    "options": ["choir_small_8_to_15", "choir_large_15plus", "string_quartet", "string_trio", "chamber_ensemble"],
    "required": true
  },
  "service_categories": {
    "type": "multi_select",
    "label": "Service categories",
    "options": ["catholic_mass", "christian_worship", "civil_ceremony", "processional_only", "full_ceremony", "reception_dinner_music"]
  },
  "religious_certifications": {
    "type": "multi_select",
    "label": "Religious certifications",
    "options": ["archdiocesan_approved", "choir_master_certified", "music_director_credentialed"]
  },
  "repertoire_size":           { "type": "int", "min": 50, "label": "Repertoire size (at least 50 pieces)" },
  "conductor_included":        { "type": "boolean", "label": "Conductor / choir-master included" },
  "uniform_or_attire_included": { "type": "boolean", "label": "Performance uniforms / attire included" },
  "sample_audio_urls":         { "type": "multi_select_open", "label": "Sample audio URLs (YouTube / Vimeo) — at least 2" }
}
$json$::jsonb,
    filter_facets = $json$["ensemble_type", "service_categories", "religious_certifications", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":      ["ensemble_type", "service_categories", "service_regions"],
  "minimum_sample_audio": 2
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'choir_string_quartet';

-- ----------------------------------------------------------------------------
-- 4. wedding_singer — solo vocalist
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "voice_type": {
    "type": "enum",
    "label": "Voice type",
    "options": ["soprano", "mezzo_soprano", "alto", "tenor", "baritone", "bass"],
    "required": true
  },
  "repertoire_genres": {
    "type": "multi_select",
    "label": "Repertoire genres",
    "options": ["opm", "ballads", "pop", "jazz", "classical", "religious_liturgical", "broadway", "rnb"],
    "required": true
  },
  "ceremony_song_specialty": {
    "type": "multi_select",
    "label": "Ceremony song specialty",
    "options": ["unity_candle_song", "processional", "communion", "recessional", "first_dance"]
  },
  "languages_offered": {
    "type": "multi_select",
    "label": "Languages offered",
    "options": ["english", "tagalog", "spanish", "italian_opera", "latin_liturgical"]
  },
  "accepts_song_requests":      { "type": "boolean", "label": "Accepts couple song requests" },
  "duo_capable_with_pianist":   { "type": "boolean", "label": "Can perform as duo with pianist" },
  "sample_audio_urls":          { "type": "multi_select_open", "label": "Sample audio URLs (YouTube / Vimeo) — at least 2" }
}
$json$::jsonb,
    filter_facets = $json$["voice_type", "repertoire_genres", "ceremony_song_specialty", "languages_offered", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":      ["voice_type", "repertoire_genres", "service_regions"],
  "minimum_sample_audio": 2
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'wedding_singer';

-- ----------------------------------------------------------------------------
-- 5. kulintang_ensemble — PH Muslim instrumental ensemble
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "ensemble_type": {
    "type": "enum",
    "label": "Ensemble type",
    "options": ["traditional_kulintang_5_player", "expanded_with_agung", "mixed_kulintang_modern"],
    "required": true
  },
  "ethnic_specialization": {
    "type": "multi_select",
    "label": "Ethnic specialization",
    "options": ["maranao", "maguindanao", "tausug", "yakan", "sama_bajau"]
  },
  "ceremonial_or_performance": {
    "type": "enum",
    "label": "Ceremonial or performance",
    "options": ["ceremonial_only", "performance_only", "both"]
  },
  "religious_appropriateness": {
    "type": "multi_select",
    "label": "Religious appropriateness",
    "options": ["islamic_wedding", "cultural_celebration", "secular_event"]
  },
  "traditional_costume_provided": { "type": "boolean", "label": "Traditional costume provided" },
  "performer_count":              { "type": "int", "label": "Performer count" },
  "sample_audio_urls":            { "type": "multi_select_open", "label": "Sample audio URLs (YouTube / Vimeo) — at least 1" }
}
$json$::jsonb,
    filter_facets = $json$["ensemble_type", "ethnic_specialization", "religious_appropriateness", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":      ["ensemble_type", "service_regions"],
  "minimum_sample_audio": 1
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'kulintang_ensemble';

-- ----------------------------------------------------------------------------
-- 6. rondalla_ensemble — PH plucked-string ensemble
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "ensemble_size": {
    "type": "enum",
    "label": "Ensemble size",
    "options": ["small_4_to_6", "medium_7_to_10", "large_11plus"],
    "required": true
  },
  "instrument_family": {
    "type": "multi_select",
    "label": "Instrument family",
    "options": ["banduria", "octavina", "laud", "bajo_de_unas", "guitar"]
  },
  "repertoire_specialty": {
    "type": "multi_select",
    "label": "Repertoire specialty",
    "options": ["classical_filipino", "kundiman", "folk_dances", "modern_arrangements", "religious_pieces"]
  },
  "traditional_costume_provided": { "type": "boolean", "label": "Traditional costume provided" },
  "sample_audio_urls":            { "type": "multi_select_open", "label": "Sample audio URLs (YouTube / Vimeo) — at least 1" }
}
$json$::jsonb,
    filter_facets = $json$["ensemble_size", "instrument_family", "repertoire_specialty", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":      ["ensemble_size", "service_regions"],
  "minimum_sample_audio": 1
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'rondalla_ensemble';

-- ----------------------------------------------------------------------------
-- 7. folk_performer — PH cultural folk groups
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "folk_traditions": {
    "type": "multi_select",
    "label": "Folk traditions",
    "options": ["igorot", "cordillera", "sagala", "t_boli", "manobo", "kapampangan", "ilocano", "kalinga", "bagobo"],
    "required": true
  },
  "performance_types": {
    "type": "multi_select",
    "label": "Performance types",
    "options": ["dance", "music", "ceremony_ritual", "processional"]
  },
  "group_size":                            { "type": "int", "label": "Group size" },
  "traditional_costume_provided":          { "type": "boolean", "label": "Traditional costume provided" },
  "cultural_authenticity_certification": {
    "type": "multi_select",
    "label": "Cultural authenticity certification",
    "options": ["ncca_certified", "tribal_council_endorsed"]
  },
  "sample_video_urls":                     { "type": "multi_select_open", "label": "Sample video URLs (YouTube / Vimeo) — at least 1" }
}
$json$::jsonb,
    filter_facets = $json$["folk_traditions", "performance_types", "cultural_authenticity_certification", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":      ["folk_traditions", "service_regions"],
  "minimum_sample_video": 1
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'folk_performer';

-- ----------------------------------------------------------------------------
-- 8. setnayan_pakanta — Setnayan custom-song service (first-party)
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "delivery_format": {
    "type": "multi_select",
    "label": "Delivery format",
    "options": ["studio_mp4", "live_recording", "lyric_video", "instrumental_track"]
  },
  "song_length_minutes":           { "type": "int", "label": "Song length (minutes)" },
  "revisions_included":            { "type": "int", "label": "Revisions included" },
  "delivery_timeline_weeks":       { "type": "int", "label": "Delivery timeline (weeks)" },
  "studio_production_quality":     { "type": "boolean", "label": "Studio-grade production" },
  "songwriter_credit":             { "type": "text_short", "label": "Lead songwriter credit" },
  "sample_audio_urls":             { "type": "multi_select_open", "label": "Sample audio URLs (YouTube / Vimeo)" }
}
$json$::jsonb,
    filter_facets = $json$["delivery_format", "delivery_timeline_weeks", "studio_production_quality", "starting_price_centavos"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields": ["delivery_format", "song_length_minutes"]
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'setnayan_pakanta';

-- ----------------------------------------------------------------------------
-- 9. setnayan_panood — Setnayan multi-cam livestream (first-party)
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "stream_quality": {
    "type": "enum",
    "label": "Stream quality",
    "options": ["1080p_standard", "1080p_premium", "4k"]
  },
  "camera_count":            { "type": "int", "label": "Camera count" },
  "duration_hours_max":      { "type": "int", "label": "Maximum duration (hours)" },
  "recorded_replay_included": { "type": "boolean", "label": "Recorded replay included" },
  "platforms_supported": {
    "type": "multi_select",
    "label": "Streaming platforms supported",
    "options": ["youtube_unlisted", "vimeo_private", "facebook_live", "zoom"]
  },
  "chat_moderation_included":  { "type": "boolean", "label": "Chat moderation included" },
  "sample_video_urls":         { "type": "multi_select_open", "label": "Sample video URLs (YouTube / Vimeo)" }
}
$json$::jsonb,
    filter_facets = $json$["stream_quality", "camera_count", "duration_hours_max", "platforms_supported", "starting_price_centavos"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields": ["stream_quality", "camera_count"]
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'setnayan_panood';

-- ----------------------------------------------------------------------------
-- 10. dj — wedding DJ
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "music_genres": {
    "type": "multi_select",
    "label": "Music genres",
    "options": ["pop", "dance_edm", "hip_hop", "opm", "classic_rock", "latin", "reggae", "world_music", "throwback_80s_90s", "kpop"],
    "required": true
  },
  "dj_experience_years":      { "type": "int", "label": "DJ experience (years)" },
  "equipment_provided": {
    "type": "multi_select",
    "label": "Equipment provided",
    "options": ["turntables_classic", "controller_setup", "full_pa_system", "lighting_basic", "lighting_premium", "smoke_fog_machine"]
  },
  "takes_requests": {
    "type": "enum",
    "label": "Takes requests",
    "options": ["yes_all_night", "yes_limited_to_pre_approved", "no_strictly_setlist"]
  },
  "mc_skills":                { "type": "boolean", "label": "MC skills included" },
  "mixed_sets_per_event":     { "type": "int", "label": "Mixed sets typical per event" },
  "ceremony_capable":         { "type": "boolean", "label": "Ceremony-capable (subtle background)" },
  "sample_audio_urls":        { "type": "multi_select_open", "label": "Sample audio mixes (YouTube / Vimeo / SoundCloud) — at least 2" }
}
$json$::jsonb,
    filter_facets = $json$["music_genres", "equipment_provided", "takes_requests", "mc_skills", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":      ["music_genres", "service_regions"],
  "minimum_sample_audio": 2
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'dj';

-- ----------------------------------------------------------------------------
-- 11. wedding_entertainment — magicians, fire dancers, mentalists, etc.
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "entertainment_types": {
    "type": "multi_select",
    "label": "Entertainment types",
    "options": ["magician", "fire_dancer", "mentalist", "juggler", "balloon_twister", "character_performer", "comedy_act", "illusionist", "mind_reader", "caricature_live", "human_statue"],
    "required": true
  },
  "audience_age_appeal": {
    "type": "multi_select",
    "label": "Audience age appeal",
    "options": ["kids_4_to_12", "teens", "adults", "all_ages"]
  },
  "performance_duration_minutes": { "type": "int", "label": "Performance duration (minutes)" },
  "group_or_solo": {
    "type": "enum",
    "label": "Group or solo",
    "options": ["solo", "duo", "group_3_to_5", "group_6plus"]
  },
  "interactive_with_audience":    { "type": "boolean", "label": "Interactive with audience" },
  "sample_video_urls":            { "type": "multi_select_open", "label": "Sample video URLs (YouTube / Vimeo) — at least 1" }
}
$json$::jsonb,
    filter_facets = $json$["entertainment_types", "audience_age_appeal", "group_or_solo", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":      ["entertainment_types", "service_regions"],
  "minimum_sample_video": 1
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'wedding_entertainment';

-- ----------------------------------------------------------------------------
-- 12. entourage_choreographer — PH wedding entourage entry dance
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "dance_styles": {
    "type": "multi_select",
    "label": "Dance styles",
    "options": ["traditional_filipino", "classical_ballroom", "contemporary_pop", "latin_salsa", "korean_kpop", "broadway_musical_theater", "hip_hop", "group_routine"],
    "required": true
  },
  "entourage_sizes_handled": {
    "type": "multi_select",
    "label": "Entourage sizes handled",
    "options": ["intimate_4_to_8", "standard_8_to_16", "grand_16plus"]
  },
  "rehearsal_sessions_typical": { "type": "int", "label": "Typical rehearsal sessions" },
  "rehearsal_hours_typical":    { "type": "int", "label": "Typical rehearsal hours (per session)" },
  "video_choreography_review":  { "type": "boolean", "label": "Video review between sessions" },
  "props_choreography_included": { "type": "boolean", "label": "Props choreography included" },
  "sample_video_urls":          { "type": "multi_select_open", "label": "Sample choreography videos (YouTube / Vimeo) — at least 1" }
}
$json$::jsonb,
    filter_facets = $json$["dance_styles", "entourage_sizes_handled", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields":      ["dance_styles", "service_regions"],
  "minimum_sample_video": 1
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'entourage_choreographer';

-- ----------------------------------------------------------------------------
-- 13. first_dance_choreographer — couple-specific first dance prep
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "dance_styles": {
    "type": "multi_select",
    "label": "Dance styles",
    "options": ["ballroom_waltz", "latin_salsa", "contemporary", "pop_modern", "kpop_inspired", "surprise_choreo", "swing_jive"],
    "required": true
  },
  "private_lesson_count":               { "type": "int", "label": "Private lessons included" },
  "lesson_duration_minutes":            { "type": "int", "label": "Lesson duration (minutes)" },
  "video_review_between_sessions":      { "type": "boolean", "label": "Video review between sessions" },
  "couple_song_consultation":           { "type": "boolean", "label": "Couple-song consultation included" },
  "performance_walkthrough_on_wedding_day": { "type": "boolean", "label": "Day-of performance walkthrough" },
  "sample_video_urls":                  { "type": "multi_select_open", "label": "Sample first-dance videos (YouTube / Vimeo)" }
}
$json$::jsonb,
    filter_facets = $json$["dance_styles", "private_lesson_count", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields": ["dance_styles", "service_regions"]
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'first_dance_choreographer';

-- ----------------------------------------------------------------------------
-- 14. pre_cana_dance_trainer — PH Catholic-tradition specific
-- ----------------------------------------------------------------------------

UPDATE public.canonical_service_schemas
SET category_specific_attributes = $json$
{
  "dance_types": {
    "type": "multi_select",
    "label": "Dance types",
    "options": ["first_dance", "parents_dance", "group_traditional", "entrance_processional"]
  },
  "session_duration_hours":         { "type": "int", "label": "Session duration (hours)" },
  "session_count_typical":          { "type": "int", "label": "Typical session count" },
  "includes_choreography_video":    { "type": "boolean", "label": "Includes choreography video reference" },
  "couple_or_full_entourage": {
    "type": "enum",
    "label": "Couple or full entourage",
    "options": ["couple_only", "full_entourage", "both"]
  },
  "catholic_tradition_aware":       { "type": "boolean", "label": "Catholic-tradition specific (pamamanhikan / processional)" },
  "sample_video_urls":              { "type": "multi_select_open", "label": "Sample reference videos (YouTube / Vimeo)" }
}
$json$::jsonb,
    filter_facets = $json$["dance_types", "couple_or_full_entourage", "catholic_tradition_aware", "starting_price_centavos", "service_regions"]$json$::jsonb,
    required_for_visibility = $json$
{
  "minimum_fields": ["dance_types", "service_regions"]
}
$json$::jsonb,
    updated_at = NOW()
WHERE canonical_service = 'pre_cana_dance_trainer';

COMMIT;
