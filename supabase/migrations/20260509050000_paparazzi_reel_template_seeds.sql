-- Tayo V1 — Iteration 0012: seed Personal Reel template catalogue (locked 2026-05-09)
--
-- Six starter templates, one per reel_feel_category. The 12-month rotation
-- ritual (per 14_Tayo_Music_Catalogue_Cowork_Playbook.md) refreshes this set
-- annually based on purchase counts. The full catalogue grows to ~400
-- templates as the AI music pipeline lands; this seed gets the builder UI
-- usable on day one.
--
-- Idempotent: ON CONFLICT (slug) DO NOTHING preserves any production-edited
-- rows. Manifest JSON is an opaque blob the renderer (Cloudflare Workers +
-- FFmpeg) interprets; the shape used here is a minimum-viable spec covering
-- intro card, photo slots with crops, transitions, music ducking, and outro.

INSERT INTO reel_templates (
  slug, display_name, feel_category, manifest_json, paired_track_ids,
  duration_min_s, duration_max_s, production_ready
) VALUES
  (
    'bridgerton_strings',
    'Bridgerton Strings',
    'bridgerton_feel',
    '{
      "version": 1,
      "intro": { "duration_s": 1.5, "card": "couple_monogram_or_logo", "fade_in": true },
      "photo_slots": {
        "min": 1,
        "max": 5,
        "crop": "ken_burns",
        "transition": "soft_dissolve",
        "duration_s": 2.5
      },
      "couple_clip_slots": { "min": 0, "max": 5, "interleave": "round_robin" },
      "outro": { "duration_s": 1.5, "card": "couple_monogram_or_logo" },
      "color_grade": "warm_film",
      "audio": { "track_slug": "courtly_strings_01", "duck_under_clip_audio_db": -8 }
    }'::JSONB,
    ARRAY[]::UUID[],
    8, 30, TRUE
  ),
  (
    'eras_pop',
    'Eras Pop',
    'taylor_swift_feel',
    '{
      "version": 1,
      "intro": { "duration_s": 1.0, "card": "couple_initials_pop" },
      "photo_slots": {
        "min": 1,
        "max": 5,
        "crop": "ken_burns",
        "transition": "whip_pan",
        "duration_s": 1.8,
        "rhythm": "on_beat"
      },
      "couple_clip_slots": { "min": 0, "max": 5, "interleave": "alternating" },
      "outro": { "duration_s": 1.5, "card": "heart_accent" },
      "color_grade": "soft_pastel",
      "audio": { "track_slug": "anthem_pop_01", "duck_under_clip_audio_db": -10 }
    }'::JSONB,
    ARRAY[]::UUID[],
    6, 30, TRUE
  ),
  (
    'mj_groove',
    'MJ Groove',
    'mj_feel',
    '{
      "version": 1,
      "intro": { "duration_s": 0.8, "card": "spotlight" },
      "photo_slots": {
        "min": 1,
        "max": 5,
        "crop": "ken_burns",
        "transition": "flash_cut",
        "duration_s": 1.2,
        "rhythm": "on_beat"
      },
      "couple_clip_slots": { "min": 0, "max": 5, "interleave": "alternating" },
      "outro": { "duration_s": 1.2, "card": "spotlight_close" },
      "color_grade": "saturated_neon",
      "audio": { "track_slug": "groove_funk_01", "duck_under_clip_audio_db": -10 }
    }'::JSONB,
    ARRAY[]::UUID[],
    5, 30, TRUE
  ),
  (
    'cocktail_jazz',
    'Cocktail Jazz',
    'jazz',
    '{
      "version": 1,
      "intro": { "duration_s": 1.8, "card": "couple_monogram_or_logo", "fade_in": true },
      "photo_slots": {
        "min": 1,
        "max": 5,
        "crop": "ken_burns",
        "transition": "slow_fade",
        "duration_s": 3.2
      },
      "couple_clip_slots": { "min": 0, "max": 5, "interleave": "round_robin" },
      "outro": { "duration_s": 2.0, "card": "couple_monogram_or_logo" },
      "color_grade": "vintage_sepia",
      "audio": { "track_slug": "smoky_jazz_01", "duck_under_clip_audio_db": -6 }
    }'::JSONB,
    ARRAY[]::UUID[],
    10, 30, TRUE
  ),
  (
    'sunday_morning',
    'Sunday Morning',
    'sunday_morning',
    '{
      "version": 1,
      "intro": { "duration_s": 1.2, "card": "soft_serif", "fade_in": true },
      "photo_slots": {
        "min": 1,
        "max": 5,
        "crop": "ken_burns",
        "transition": "long_dissolve",
        "duration_s": 3.0
      },
      "couple_clip_slots": { "min": 0, "max": 5, "interleave": "round_robin" },
      "outro": { "duration_s": 1.8, "card": "soft_serif" },
      "color_grade": "airy_pastel",
      "audio": { "track_slug": "acoustic_morning_01", "duck_under_clip_audio_db": -6 }
    }'::JSONB,
    ARRAY[]::UUID[],
    10, 30, TRUE
  ),
  (
    'street_hip_hop',
    'Street Hip-Hop',
    'hip_hop',
    '{
      "version": 1,
      "intro": { "duration_s": 0.6, "card": "kinetic_type" },
      "photo_slots": {
        "min": 1,
        "max": 5,
        "crop": "ken_burns",
        "transition": "hard_cut",
        "duration_s": 1.0,
        "rhythm": "on_beat"
      },
      "couple_clip_slots": { "min": 0, "max": 5, "interleave": "alternating" },
      "outro": { "duration_s": 1.0, "card": "tag_signature" },
      "color_grade": "high_contrast_cool",
      "audio": { "track_slug": "boom_bap_01", "duck_under_clip_audio_db": -12 }
    }'::JSONB,
    ARRAY[]::UUID[],
    4, 30, TRUE
  )
ON CONFLICT (slug) DO NOTHING;
