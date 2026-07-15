-- seed_remaining_event_type_profiles
-- Seed event_type_profiles for the last three enabled NON-WEDDING types that had
-- no profile row and were falling back to GENERIC_PROFILE (organizer_noun 'host',
-- event_word 'event'): anniversary, graduation, reunion. This gives each its own
-- terminology + the generic surface set + onboarding_flow_key, so resolveProfile()
-- returns a per-type profile and the generic /onboarding/[type] flow renders their
-- newly-authored signature questions + persona packs (PER_TYPE_QUESTIONS /
-- PERSONA_PACKS). Mirrors 20270221005058 (the Phase-3 non-wedding seed) exactly.
--
-- enabled_surfaces = the GENERIC_PROFILE set (dashboard tools only): seating,
-- budget, schedule, day_of, gallery. role_set_key 'generic' → GENERIC_ROLE_SET
-- (host/vip/family/helper). onboarding_flow_key = the type (= personaPackKey).
--
-- IDEMPOTENT + non-destructive: ON CONFLICT DO NOTHING — never overwrites an
-- existing row (so a later admin edit via /admin/event-types/<type>/profile
-- survives a re-run) and NEVER touches the 'wedding' row (not in this list).
-- (gala_night is intentionally excluded — it has no event_type_vocab row.)
INSERT INTO public.event_type_profiles (
  event_type, terminology, enabled_surfaces,
  onboarding_flow_key, role_set_key, template_pack_key, monogram_set_key,
  reveal_pack_key, budget_taxonomy_key, schedule_seed_key, statutory_pack_key
) VALUES
  ('anniversary',
   '{"organizer_noun":"celebrant","person_a":null,"person_b":null,"seat_word":"table","event_word":"anniversary","vip_tier_label":"Guests of honor"}'::jsonb,
   ARRAY['seating','budget','schedule','day_of','gallery'],
   'anniversary','generic',NULL,NULL,NULL,NULL,NULL,NULL),
  ('graduation',
   '{"organizer_noun":"graduate","person_a":null,"person_b":null,"seat_word":"table","event_word":"graduation","vip_tier_label":"Guests of honor"}'::jsonb,
   ARRAY['seating','budget','schedule','day_of','gallery'],
   'graduation','generic',NULL,NULL,NULL,NULL,NULL,NULL),
  ('reunion',
   '{"organizer_noun":"host","person_a":null,"person_b":null,"seat_word":"table","event_word":"reunion","vip_tier_label":"Guests of honor"}'::jsonb,
   ARRAY['seating','budget','schedule','day_of','gallery'],
   'reunion','generic',NULL,NULL,NULL,NULL,NULL,NULL)
ON CONFLICT (event_type) DO NOTHING;
