-- concert_open_house_grand_opening
-- Created via `pnpm migration:new`. Idempotent: every INSERT is ON CONFLICT DO
-- NOTHING (an admin's later edit from /admin/event-types is never stomped),
-- every array append is guarded, the CHECK is dropped before it is re-added.
--
-- 🎤 THREE NEW KINDS OF EVENT: CONCERT · OPEN HOUSE · GRAND OPENING
-- Owner, 2026-09-29 (spec corpus DECISION_LOG "DISCOVER — UNPARKED", item b:
-- *"yes to all"*): "Concert · Open house · Grand opening · Competition (as
-- Tournament) join the event types". Competition is NOT a type — it is a search
-- word that finds `tournament` (apps/web/lib/event-vocabulary.ts). Only three
-- rows are minted here.
--
-- All three are public, organizer-run events — the shape of `corporate` and
-- `gala_night`, which is where every value below is copied from rather than
-- invented. Where a value governs MONEY it is the DEFAULT MADE EXPLICIT, never
-- a new number:
--
--   · Setnayan AI band — `ai_price_tier` is seeded NULL = "no band chosen"
--     (20271177907226). It resolves to C through setnayan_ai_price_tier()'s
--     fallback — exactly what the code map says — and /admin/pricing → Setnayan
--     AI prices shows each one as "no band yet", asking the owner out loud.
--   · Papic pool sizing — each row is a COPY of the 'default' row, which is
--     exactly what papic_event_pool_sizing() answers for a type with no row. The
--     per-head figure is the owner's to set at /admin/pricing; nothing moves.
--
-- ORDER MATTERS: the vocab rows first (events.event_type and the
-- applicable_event_types trigger both validate against them), then everything
-- that points at them.

-- ---- 1. the vocabulary ------------------------------------------------------
INSERT INTO public.event_type_vocab
  (event_type, label_en, sort_order, status, emoji, enabled, description, ai_price_tier)
SELECT v.event_type, v.label_en, m.max_order + v.n, 'active', v.emoji, TRUE, v.description, NULL
  FROM (VALUES
    (1, 'concert',       'Concert',       '🎤', 'Live music for a crowd — the stage, the sound, the night.'),
    (2, 'open_house',    'Open house',    '🏡', 'Doors open — guests drop by to see the place and meet the people.'),
    (3, 'grand_opening', 'Grand opening', '🎀', 'The ribbon, the blessing, the first customers through the door.')
  ) AS v(n, event_type, label_en, emoji, description)
 CROSS JOIN (SELECT COALESCE(max(sort_order), 0) AS max_order FROM public.event_type_vocab) m
ON CONFLICT (event_type) DO NOTHING;

-- ---- 2. the profiles (the words, the surfaces, the class) -------------------
-- Copied from `corporate` / `gala_night` (20270221005058 · 20271026170286),
-- with 'livestream' and 'song' like every organizer-run row since
-- 20271188752170. Never 'monogram' — that stays wedding-only.
--   · concert        — seated, like a gala: 'seating' stays, the seat word is
--                      "seat" (tournament's word for a numbered seat).
--   · open_house /
--     grand_opening  — walk-in, drop-by events: NO 'seating', the same rule
--                      20271175884168 applied to kinds that do not seat people.
-- event_class 'community_eligible' like corporate: a Samahan can run a concert
-- or open its own doors. Step 5 widens the CHECK that enforces it.
INSERT INTO public.event_type_profiles (
  event_type, terminology, enabled_surfaces, marketplace_enabled,
  event_class, layer_mode, multi_day,
  onboarding_flow_key, role_set_key
)
VALUES
  (
    'concert',
    jsonb_build_object(
      'organizer_noun', 'organizer',
      'person_a', NULL,
      'person_b', NULL,
      'seat_word', 'seat',
      'event_word', 'concert',
      'vip_tier_label', 'VIP guests'
    ),
    ARRAY['budget','day_of','gallery','livestream','rsvp','schedule','seating','song','website'],
    TRUE, 'community_eligible', 'anchored', FALSE,
    'concert', 'generic'
  ),
  (
    'open_house',
    jsonb_build_object(
      'organizer_noun', 'host',
      'person_a', NULL,
      'person_b', NULL,
      'seat_word', 'table',
      'event_word', 'open house',
      'vip_tier_label', 'Guests of honor'
    ),
    ARRAY['budget','day_of','gallery','livestream','rsvp','schedule','song','website'],
    TRUE, 'community_eligible', 'anchored', FALSE,
    'open_house', 'generic'
  ),
  (
    'grand_opening',
    jsonb_build_object(
      'organizer_noun', 'organizer',
      'person_a', NULL,
      'person_b', NULL,
      'seat_word', 'table',
      'event_word', 'grand opening',
      'vip_tier_label', 'VIP guests'
    ),
    ARRAY['budget','day_of','gallery','livestream','rsvp','schedule','song','website'],
    TRUE, 'community_eligible', 'anchored', FALSE,
    'grand_opening', 'generic'
  )
ON CONFLICT (event_type) DO NOTHING;

-- ---- 3. the marketplace reach — the same tiles as `corporate` ---------------
-- Without this a new type sees only the universal (NULL) tiles: a concert
-- would be offered no sound, no stage, no photographer. `corporate` is the
-- nearest shipped reach (the 2026-07-22 reach study), so each new type joins
-- every tile corporate is in — an owner-tunable starting point, not a study.
UPDATE public.service_categories
   SET applicable_event_types = applicable_event_types || ARRAY['concert']::text[], updated_at = now()
 WHERE applicable_event_types IS NOT NULL
   AND 'corporate' = ANY(applicable_event_types)
   AND NOT ('concert' = ANY(applicable_event_types));
UPDATE public.service_categories
   SET applicable_event_types = applicable_event_types || ARRAY['open_house']::text[], updated_at = now()
 WHERE applicable_event_types IS NOT NULL
   AND 'corporate' = ANY(applicable_event_types)
   AND NOT ('open_house' = ANY(applicable_event_types));
UPDATE public.service_categories
   SET applicable_event_types = applicable_event_types || ARRAY['grand_opening']::text[], updated_at = now()
 WHERE applicable_event_types IS NOT NULL
   AND 'corporate' = ANY(applicable_event_types)
   AND NOT ('grand_opening' = ANY(applicable_event_types));

UPDATE public.canonical_service_taxonomy
   SET applicable_event_types = applicable_event_types || ARRAY['concert']::text[]
 WHERE applicable_event_types IS NOT NULL
   AND 'corporate' = ANY(applicable_event_types)
   AND NOT ('concert' = ANY(applicable_event_types));
UPDATE public.canonical_service_taxonomy
   SET applicable_event_types = applicable_event_types || ARRAY['open_house']::text[]
 WHERE applicable_event_types IS NOT NULL
   AND 'corporate' = ANY(applicable_event_types)
   AND NOT ('open_house' = ANY(applicable_event_types));
UPDATE public.canonical_service_taxonomy
   SET applicable_event_types = applicable_event_types || ARRAY['grand_opening']::text[]
 WHERE applicable_event_types IS NOT NULL
   AND 'corporate' = ANY(applicable_event_types)
   AND NOT ('grand_opening' = ANY(applicable_event_types));

-- ---- 4. Papic pool sizing — the 'default' row, made explicit ----------------
-- Seeded from 'default' column for column, INCLUDING the per-head figure and
-- the recommendation floor — so a concert is sized exactly as it would be with
-- no row at all. What changes is that the admin screen now lists the kind, so
-- the owner can give it its own figure.
INSERT INTO public.papic_event_pool_config (
  config_key, points_per_guest, floor_points, recommend_floor_points, ceiling_points,
  soft_stop_pct, pass_service_codes, is_active,
  camera_grant_points, free_grant_points, free_one_camera_points
)
SELECT
  v.event_type,
  d.points_per_guest, d.floor_points, d.recommend_floor_points, d.ceiling_points,
  d.soft_stop_pct, d.pass_service_codes, d.is_active,
  d.camera_grant_points, d.free_grant_points, d.free_one_camera_points
FROM public.papic_event_pool_config d
CROSS JOIN (VALUES ('concert'), ('open_house'), ('grand_opening')) AS v(event_type)
WHERE d.config_key = 'default'
ON CONFLICT (config_key) DO NOTHING;

-- ---- 5. a Samahan may own them ----------------------------------------------
-- The bypass-proof backstop for event_class (20270808218211: "Widening this
-- list later = one small migration"). The three new community-eligible kinds
-- join the list; nothing already on it leaves. Widening only — every existing
-- row still passes, so re-validation cannot fail.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_community_class_consistency;
ALTER TABLE public.events
  ADD CONSTRAINT events_community_class_consistency
  CHECK (
    community_id IS NULL
    OR event_type::text IN
      ('simple_event', 'corporate', 'travel', 'celebration',
       'tournament', 'reunion', 'anniversary',
       'concert', 'open_house', 'grand_opening')
  );

-- ---- post-conditions — refuse to apply a half-registered kind ---------------
DO $$
DECLARE
  k TEXT;
BEGIN
  FOREACH k IN ARRAY ARRAY['concert','open_house','grand_opening'] LOOP
    IF NOT EXISTS (SELECT 1 FROM public.event_type_vocab
                    WHERE event_type = k AND enabled AND status = 'active') THEN
      RAISE EXCEPTION 'refusing to apply: % is not an enabled, active event type', k;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.event_type_profiles
                    WHERE event_type = k AND 'website' = ANY(enabled_surfaces)) THEN
      RAISE EXCEPTION 'refusing to apply: % has no profile with the website surface — its guest page would 404', k;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.papic_event_pool_config WHERE config_key = k) THEN
      RAISE EXCEPTION 'refusing to apply: % has no Papic sizing row', k;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.service_categories WHERE k = ANY(applicable_event_types)) THEN
      RAISE EXCEPTION 'refusing to apply: % reaches no marketplace tile', k;
    END IF;
  END LOOP;
END $$;
