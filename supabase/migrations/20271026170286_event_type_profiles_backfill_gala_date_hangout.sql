-- 20271026170286_event_type_profiles_backfill_gala_date_hangout.sql
--
-- Three of the sixteen ACTIVE event types have no `event_type_profiles` row:
-- gala_night, date, hangout. Owner 2026-07-31: "all must be active. ALL EVENTS."
--
-- WHY THIS IS NOT URGENT AND STILL WORTH DOING. `resolveProfile()` falls back to
-- `fallbackFor(eventType)` → GENERIC_PROFILE for an unknown type, and
-- GENERIC_PROFILE enables website · rsvp · seating · budget · schedule · day_of
-- · gallery. So these three WORK today — they are not broken, they are
-- UNDECLARED. What they lose is everything the row carries and the fallback
-- leaves null: `onboarding_flow_key`, `role_set_key`, and all six content-pack
-- keys. Every other active type names its own onboarding flow; these three ride
-- a default nobody chose.
--
-- The real risk is the next reader. A future column added to this table with a
-- consumer that does not go through resolveProfile(), or any code path reading
-- the row directly, degrades silently for exactly these three — and the symptom
-- will be a wrong VALUE, not an error. Declaring them costs one row each.
--
-- VALUES CHOSEN FROM THE SHIPPED NEIGHBOURS, not invented:
--   · gala_night  → mirrors `corporate` (formal, organizer-run, VIP guests). It
--     is Tier B in the AI ladder alongside corporate/debut, so the same shape is
--     the consistent read. multi_day FALSE: a gala is one night by name.
--   · date        → the two-person outing. Wording deliberately plain;
--     `marketplace_enabled` stays TRUE because `date` IS tiered for vendors
--     (restaurant / florist / cake already map to it) — `simple_event` is the
--     only marketplace-off type.
--   · hangout     → the barkada get-together. Same shape as date.
--
-- event_class `community_eligible` for all three, matching celebration /
-- anniversary / corporate. The owner-locked exclusion covers PERSONAL-MILESTONE
-- types only (wedding · debut · christening · gender reveal · birthday ·
-- graduation) — a gala, a date night or a barkada hangout is exactly the kind of
-- thing a Samahan should be able to own.
--
-- layer_mode `anchored` (a venue is fed; food comes TO the event) rather than
-- `roaming`, which is travel's itinerary model.
--
-- IDEMPOTENT: ON CONFLICT DO NOTHING — this never overwrites a row an admin has
-- since authored from /admin/event-types. Once a row exists the console is the
-- authority, and a re-apply must not stomp it.

INSERT INTO public.event_type_profiles (
  event_type, terminology, enabled_surfaces, marketplace_enabled,
  event_class, layer_mode, multi_day,
  onboarding_flow_key, role_set_key
)
VALUES
  (
    'gala_night',
    jsonb_build_object(
      'organizer_noun', 'organizer',
      'person_a', NULL,
      'person_b', NULL,
      'seat_word', 'table',
      'event_word', 'gala',
      'vip_tier_label', 'VIP guests'
    ),
    ARRAY['budget','day_of','gallery','rsvp','schedule','seating','website'],
    TRUE, 'community_eligible', 'anchored', FALSE,
    'gala_night', 'generic'
  ),
  (
    'date',
    jsonb_build_object(
      'organizer_noun', 'host',
      'person_a', NULL,
      'person_b', NULL,
      'seat_word', 'table',
      'event_word', 'date',
      'vip_tier_label', 'Guests of honor'
    ),
    ARRAY['budget','day_of','gallery','rsvp','schedule','seating','website'],
    TRUE, 'community_eligible', 'anchored', FALSE,
    'date', 'generic'
  ),
  (
    'hangout',
    jsonb_build_object(
      'organizer_noun', 'host',
      'person_a', NULL,
      'person_b', NULL,
      'seat_word', 'table',
      'event_word', 'hangout',
      'vip_tier_label', 'Guests of honor'
    ),
    ARRAY['budget','day_of','gallery','rsvp','schedule','seating','website'],
    TRUE, 'community_eligible', 'anchored', FALSE,
    'hangout', 'generic'
  )
ON CONFLICT (event_type) DO NOTHING;

-- ── Post-conditions ─────────────────────────────────────────────────────────
DO $$
DECLARE
  missing TEXT;
BEGIN
  -- (a) every ACTIVE type now declares a profile. Asserted against the vocab
  --     rather than a hardcoded list, so a type added later fails here loudly
  --     instead of riding the fallback unnoticed.
  SELECT string_agg(v.event_type, ', ' ORDER BY v.sort_order) INTO missing
  FROM public.event_type_vocab v
  LEFT JOIN public.event_type_profiles p ON p.event_type = v.event_type
  WHERE v.status = 'active' AND p.event_type IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'active event types still without a profile row: %', missing;
  END IF;

  -- (b) the three rows kept the surface set the fallback was already giving
  --     them, so this migration changed DECLARATION, not behaviour. Losing
  --     'website' here would 404 every guest page for those types.
  IF EXISTS (
    SELECT 1 FROM public.event_type_profiles
     WHERE event_type IN ('gala_night','date','hangout')
       AND NOT ('website' = ANY(enabled_surfaces))
  ) THEN
    RAISE EXCEPTION 'backfilled profile lost the website surface — guest pages would 404';
  END IF;
END $$;
