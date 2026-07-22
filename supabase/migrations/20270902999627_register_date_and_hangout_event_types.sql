-- register date + hangout event types
-- ============================================================================
-- Registers two casual-outing event types (owner 2026-07-22, replacing the
-- narrow "dinner_date" idea): DATE (romantic — dinner/lunch/movie dates) and
-- HANGOUT (casual — barkada dinners, coffee, movie nights). Both are short,
-- reservation-centred plans with a small vendor set; AI-priced at Tier D (₱99).
--
-- These are the LAST piece the reach-matrix study left open: `dinner_date` was
-- rejected by the applicable_event_types trigger because it wasn't in
-- event_type_vocab. This registers proper types FIRST, then scopes categories to
-- them (order matters — the trigger validates against the vocab). No profile
-- rows: both fall back to GENERIC_PROFILE (same as gala_night), which is enough
-- to create + price + match; bespoke terminology/onboarding is a later polish.
--
-- Idempotent: vocab upsert + guarded array appends (only add when absent).
-- ============================================================================

-- ---- 1. register the vocab (must precede the reach scoping) -----------------
INSERT INTO public.event_type_vocab
  (event_type, label_en, sort_order, status, emoji, enabled, description)
VALUES
  ('date', 'Date', 15, 'active', '💕', true,
   'A romantic date — dinner, lunch, or a movie, just the two of you.'),
  ('hangout', 'Hangout', 16, 'active', '🍿', true,
   'Time with friends or barkada — two or more, for a meal, coffee, or a movie night.')
ON CONFLICT (event_type) DO UPDATE
  SET label_en = excluded.label_en,
      emoji = excluded.emoji,
      description = excluded.description,
      updated_at = now();

-- ---- 2. scope the true category reach onto the new types (guarded appends) --
-- DATE (romantic): a reserved table + flowers, an optional cake + a small gift.
-- HANGOUT (barkada): a reserved table, cake, giveaways + photos to remember it.
UPDATE public.service_categories
   SET applicable_event_types = applicable_event_types || ARRAY['date','hangout']::text[], updated_at = now()
 WHERE id = 'restaurant_reservation' AND NOT ('date' = ANY(applicable_event_types));

UPDATE public.service_categories
   SET applicable_event_types = applicable_event_types || ARRAY['date']::text[], updated_at = now()
 WHERE id = 'florist' AND NOT ('date' = ANY(applicable_event_types));

UPDATE public.service_categories
   SET applicable_event_types = applicable_event_types || ARRAY['date','hangout']::text[], updated_at = now()
 WHERE id IN ('cake','souvenir_giveaways') AND NOT ('date' = ANY(applicable_event_types));

UPDATE public.service_categories
   SET applicable_event_types = applicable_event_types || ARRAY['hangout']::text[], updated_at = now()
 WHERE id = 'photo_video' AND NOT ('hangout' = ANY(applicable_event_types));
