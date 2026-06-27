-- simple event type role set and profile
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ITERATION 0053 follow-on — the "Simple Event" type (owner 2026-06-27): a
-- vendor-free event whose only purpose is to exercise the in-app Setnayan
-- services. It has NO vendor marketplace ("Explore" hidden), a generic single
-- 'guest' role list (no bride/groom, no tiers), and a date-only onboarding.
--
-- This migration is the INERT FOUNDATION (PR1). The type is seeded
-- enabled=FALSE, so it does NOT appear in the couple create-event picker yet —
-- exactly how gala_night / anniversary were staged. The activation PR flips
-- enabled=TRUE once the /onboarding/simple route + Explore-gating land. Until
-- then every change here is read-only plumbing: byte-identical for all existing
-- types.

BEGIN;

-- 1. marketplace_enabled — a deny-by-exception flag on the profile. DEFAULT TRUE
-- so every EXISTING profile row (wedding + the 8 non-wedding rows) keeps the
-- vendor marketplace exactly as today; only the Simple Event row opts out. Not
-- an enabled_surfaces allow-list entry precisely because those pre-existing rows
-- predate it and an allow-list would silently strip Explore from all of them.
ALTER TABLE public.event_type_profiles
  ADD COLUMN IF NOT EXISTS marketplace_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. The roster row. status='active' (vendors/taxonomy may reference it) but
-- enabled=FALSE → NOT yet in the couple-side create-event picker. onboarding_href
-- points at the lean date-only flow the activation PR builds; harmless while
-- disabled. Idempotent.
INSERT INTO public.event_type_vocab
  (event_type, label_en, sort_order, status, enabled, emoji, description, onboarding_href)
VALUES
  ('simple_event', 'Simple Event', 14, 'active', FALSE, '📅',
   'A lightweight event — pick a date and use Setnayan''s in-app services. No vendors, no marketplace.',
   '/onboarding/simple')
ON CONFLICT (event_type) DO NOTHING;

-- 3. The profile. marketplace_enabled=FALSE (Explore hidden); enabled_surfaces =
-- the couple TOOLS that work without vendors (seating/schedule/day_of/gallery) —
-- website/save_the_date/rsvp/monogram/budget stay OFF. role_set_key='simple' →
-- the single-'guest' SIMPLE_ROLE_SET. onboarding_flow_key='simple'. Idempotent +
-- non-destructive (never overwrites an admin's later edits).
INSERT INTO public.event_type_profiles (
  event_type, terminology, enabled_surfaces, marketplace_enabled,
  onboarding_flow_key, role_set_key, template_pack_key, monogram_set_key,
  reveal_pack_key, budget_taxonomy_key, schedule_seed_key, statutory_pack_key
) VALUES (
  'simple_event',
  '{"organizer_noun":"host","person_a":null,"person_b":null,"seat_word":"table","event_word":"event","vip_tier_label":"Guests"}'::jsonb,
  ARRAY['seating','schedule','day_of','gallery'],
  FALSE,
  'simple','simple',NULL,NULL,NULL,NULL,NULL,NULL
)
ON CONFLICT (event_type) DO NOTHING;

COMMIT;
