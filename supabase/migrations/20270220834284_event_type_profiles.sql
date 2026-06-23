-- event_type_profiles
-- Iteration 0053 — Event-Type Engine · Phase 0 (the profile spine).
--
-- A per-type config row describing WHAT an event type is: its terminology,
-- which couple-facing surfaces apply, and which content pack drives each
-- surface. Surfaces will read this via lib/event-type-profile.ts:resolveProfile()
-- instead of hard-coding "wedding" (see spec 0053_event_type_engine).
--
-- PURELY ADDITIVE / ZERO-BEHAVIOUR-CHANGE: nothing consumes this table yet, and
-- ONLY the wedding row is seeded — mirroring today's hard-coded values exactly —
-- so the app is byte-identical until later phases wire surfaces to it.
--
-- RLS mirrors event_type_vocab (migration 20261104000000): public read,
-- is_admin() write. Idempotent.

CREATE TABLE IF NOT EXISTS public.event_type_profiles (
  event_type          TEXT PRIMARY KEY
                        REFERENCES public.event_type_vocab(event_type)
                        ON UPDATE CASCADE ON DELETE CASCADE,
  -- WHAT IT'S CALLED — organizer_noun, person_a/b, seat_word, event_word, vip_tier_label
  terminology         JSONB  NOT NULL DEFAULT '{}'::jsonb,
  -- WHICH SURFACES APPLY — subset of: website, save_the_date, rsvp, seating,
  -- budget, schedule, monogram, day_of, gallery
  enabled_surfaces    TEXT[] NOT NULL DEFAULT '{}',
  -- WHICH PACK DRIVES EACH SURFACE — NULL = use the built-in generic default
  onboarding_flow_key TEXT,
  role_set_key        TEXT,
  template_pack_key   TEXT,
  monogram_set_key    TEXT,
  reveal_pack_key     TEXT,
  budget_taxonomy_key TEXT,
  schedule_seed_key   TEXT,
  statutory_pack_key  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_type_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_type_profiles_read_all ON public.event_type_profiles;
CREATE POLICY event_type_profiles_read_all
  ON public.event_type_profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS event_type_profiles_admin_write ON public.event_type_profiles;
CREATE POLICY event_type_profiles_admin_write
  ON public.event_type_profiles FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Seed ONLY wedding, mirroring today's hard-coded behaviour exactly. Every other
-- active type intentionally has NO row yet → resolveProfile() degrades it to the
-- built-in GENERIC_PROFILE. Generic rows land when the admin editor wires up
-- (Phase 1), not here, so Phase 0 decides nothing about non-wedding types.
INSERT INTO public.event_type_profiles (
  event_type, terminology, enabled_surfaces,
  onboarding_flow_key, role_set_key, template_pack_key, monogram_set_key,
  reveal_pack_key, budget_taxonomy_key, schedule_seed_key, statutory_pack_key
) VALUES (
  'wedding',
  '{"organizer_noun":"couple","person_a":"bride","person_b":"groom","seat_word":"table","event_word":"wedding","vip_tier_label":"Family & sponsors"}'::jsonb,
  ARRAY['website','save_the_date','rsvp','seating','budget','schedule','monogram','day_of','gallery'],
  'wedding','wedding','wedding','wedding','wedding','wedding','wedding','ph_marriage'
)
ON CONFLICT (event_type) DO NOTHING;
