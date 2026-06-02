-- 20260724000000_event_style_preferences.sql
--
-- Onboarding "transfer of data" → Home (owner directive 2026-06-02):
-- "create the transfer of data. we will place it on the customer dashboard
--  home Your personalized wedding information ... we want everything there.
--  the wedding dates, the location, the features that matter for the
--  different services."
--
-- The onboarding style sub-stepper captures per-service preferences
-- (reception look · ceremony setting · cuisine · catering style · dietary ·
-- photo/video look + need + coverage · music vibe · overall feel). Today
-- only `feel` (→ mood_feel_key) and the song picker (→ music_playlist_seed)
-- reach the DB; the rest are dropped at commit.
--
-- This adds a DISPLAY-oriented JSONB blob so the Home "Personalized for you"
-- card can surface "the features that matter for the different services."
--
-- DELIBERATELY a free-form JSONB column, NOT a write into
-- `event_vendor_preferences`: that table's `canonical_service` FK requires
-- the 174 fine-grained canonical_service_schemas keys, but onboarding
-- captures COARSE dimension keys (reception/ceremony/catering/photo_video/
-- music/palette) — a write there would FK-crash the live commit and the
-- match-read is inert anyway (vendor_service_attributes empty in prod). See
-- the 2026-06-02 "Phase A2 BLOCKED" decision-log row. This column is for
-- DISPLAY only (no FK, no vendor matching) and sidesteps that blocker
-- entirely.
--
-- Additive + nullable-with-default + idempotent → safe on the live pilot.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS style_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.events.style_preferences IS
  'Display-only blob of onboarding per-service style preferences (cuisine, ceremony setting, photo/video look + coverage, music vibe, dietary, reception look). Surfaced on the Home "Personalized for you" card. NOT used for vendor matching — that is event_vendor_preferences (gated on vendor facet-tagging). Owner directive 2026-06-02.';
