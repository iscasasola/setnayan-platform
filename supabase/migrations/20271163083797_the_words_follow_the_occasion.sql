-- the_words_follow_the_occasion
-- ============================================================================
-- W4-WORDS · Registers the FUNERAL event type — the product's first SOLEMN
-- occasion (owner 2026-08-17, "yes to all four": "FUNERAL and BAPTISM are
-- approved as new event types", with the funeral ruled "a TONE build across
-- the whole guest tree, not a row in a table").
--
-- DATA ONLY — no schema changes. The verification pass for this session read
-- the live tables first: `event_type_profiles.terminology` is JSONB, so the
-- two new tone keys (`register`, `occasion_noun`) ride inside the existing
-- column, and the code reads them with celebratory defaults so every existing
-- row is untouched in meaning. Baptism is deliberately NOT added: the same
-- ruling records that `christening` already covers it ("a naming/
-- discoverability question, not a new voice").
--
-- Order matters and is the same as 20270902999627 (date/hangout): the vocab
-- row must exist before service_categories may be scoped to the type, because
-- validate_applicable_event_types rejects unregistered types.
--
-- Idempotent: vocab/profile/onboarding upserts + guarded array appends.
-- ============================================================================

-- ---- 1. register the type (must precede the category scoping) --------------
-- 🕊️ not 🕯️ — the candle is christening's emoji.
INSERT INTO public.event_type_vocab
  (event_type, label_en, sort_order, status, emoji, enabled, description)
VALUES
  ('funeral', 'Funeral', 17, 'active', '🕊️', true,
   'A wake and funeral — a farewell, arranged with care.')
ON CONFLICT (event_type) DO UPDATE
  SET label_en = excluded.label_en,
      emoji = excluded.emoji,
      description = excluded.description,
      updated_at = now();

-- ---- 2. the profile: the solemn register lives HERE ------------------------
-- Mirrored by FUNERAL_PROFILE in lib/event-type-profile.ts so a DB read error
-- degrades to the SAME solemn traits — a hiccup must never flip a wake's page
-- back to "The celebration is underway".
--   · organizer_noun 'family' — the guest tree says "the family", never "the
--     couple" and never a celebrant.
--   · event_word 'wake' — "The wake is happening." on the day-of banner.
--   · occasion_noun 'gathering' — the mechanical slots ("during the
--     gathering", "for this gathering") where 'celebration' is the defect.
--   · register 'solemn' — the switch every tone branch reads: no countdown,
--     no save-the-date phase, no upsells, gentler money wording.
--   · surfaces: the GENERIC set (website · rsvp · seating · budget · schedule
--     · day_of · gallery) — no save_the_date, no monogram.
--   · event_class 'personal' — a funeral is a personal milestone; communities
--     never own those (owner lock 2026-07-15). events_community_class_
--     consistency does not list 'funeral', so the DB agrees.
--   · multi_day TRUE — a lamay runs for days before the interment.
INSERT INTO public.event_type_profiles
  (event_type, terminology, enabled_surfaces, marketplace_enabled, event_class,
   layer_mode, multi_day, onboarding_flow_key, role_set_key)
VALUES
  ('funeral',
   jsonb_build_object(
     'organizer_noun', 'family',
     'person_a', null,
     'person_b', null,
     'seat_word', 'table',
     'event_word', 'wake',
     'vip_tier_label', 'Immediate family',
     'register', 'solemn',
     'occasion_noun', 'gathering'
   ),
   ARRAY['website', 'rsvp', 'seating', 'budget', 'schedule', 'day_of', 'gallery'],
   true, 'personal', 'anchored', true, null, null)
ON CONFLICT (event_type) DO UPDATE
  SET terminology = excluded.terminology,
      enabled_surfaces = excluded.enabled_surfaces,
      marketplace_enabled = excluded.marketplace_enabled,
      event_class = excluded.event_class,
      layer_mode = excluded.layer_mode,
      multi_day = excluded.multi_day,
      updated_at = now();

-- ---- 3. the onboarding welcome, in the right voice -------------------------
-- Without this row the generic flow greets a bereaved family with the code
-- default: "Let's plan your funeral" over "A few quick questions and we'll
-- shape a plan made for your celebration." The override table is the designed
-- home for per-type intro copy (owner directive 2026-06-28) and stays
-- admin-editable.
INSERT INTO public.event_type_onboarding (event_type, intro)
VALUES
  ('funeral',
   jsonb_build_object(
     'eyebrow', 'With care',
     'headline', 'A few quiet questions, and everything is arranged in one place.',
     'subcopy', 'Free to start — no account needed yet.'
   ))
ON CONFLICT (event_type) DO UPDATE
  SET intro = excluded.intro,
      updated_at = now();

-- ---- 4. scope the true category reach (guarded appends — after step 1) -----
-- The vendors a Filipino wake actually hires: food for the lamay, funeral
-- flowers, memorial photo/video, prayer cards and tarpaulins, a funeral-mass
-- choir, transport for the procession, and a coordinator. Livestream is
-- already universal (NULL applicable_event_types), so relatives abroad can
-- watch without a row here. The funeral home itself has no category yet —
-- adding a taxonomy leaf is a separate, owner-visible change.
UPDATE public.service_categories
   SET applicable_event_types = applicable_event_types || ARRAY['funeral']::text[],
       updated_at = now()
 WHERE id IN ('catering', 'florist', 'photo_video', 'printing', 'choir',
              'guest_shuttle', 'coordinator')
   AND applicable_event_types IS NOT NULL
   AND NOT ('funeral' = ANY(applicable_event_types));
