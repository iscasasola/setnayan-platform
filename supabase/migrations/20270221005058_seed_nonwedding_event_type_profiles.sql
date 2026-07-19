-- seed_nonwedding_event_type_profiles
-- Seed event_type_profiles for the enabled NON-WEDDING types (iteration 0053
-- Phase 3 · PR4). Gives each its own terminology + the generic surface set, so
-- resolveProfile() returns a per-type profile instead of the GENERIC_PROFILE
-- fallback (organizer_noun 'host', event_word 'event'). Mirrors the Phase-0
-- wedding seed shape.
--
-- enabled_surfaces = the GENERIC_PROFILE set (dashboard tools only): seating,
-- budget, schedule, day_of, gallery — website / save_the_date / rsvp / monogram
-- stay OFF until a type gets its own content pack. role_set_key 'generic' →
-- GENERIC_ROLE_SET (host/vip/family/helper). onboarding_flow_key = the type.
--
-- IDEMPOTENT + non-destructive: ON CONFLICT DO NOTHING — never overwrites an
-- existing row (so an admin's later edits via /admin/event-types/<type>/profile
-- survive a re-run) and NEVER touches the 'wedding' row (not in this list).
INSERT INTO public.event_type_profiles (
  event_type, terminology, enabled_surfaces,
  onboarding_flow_key, role_set_key, template_pack_key, monogram_set_key,
  reveal_pack_key, budget_taxonomy_key, schedule_seed_key, statutory_pack_key
) VALUES
  ('debut',
   '{"organizer_noun":"celebrant","person_a":null,"person_b":null,"seat_word":"table","event_word":"debut","vip_tier_label":"Court of honor"}'::jsonb,
   ARRAY['seating','budget','schedule','day_of','gallery'],
   'debut','generic',NULL,NULL,NULL,NULL,NULL,NULL),
  ('gender_reveal',
   '{"organizer_noun":"host","person_a":null,"person_b":null,"seat_word":"table","event_word":"gender reveal","vip_tier_label":"Guests of honor"}'::jsonb,
   ARRAY['seating','budget','schedule','day_of','gallery'],
   'gender_reveal','generic',NULL,NULL,NULL,NULL,NULL,NULL),
  ('birthday',
   '{"organizer_noun":"celebrant","person_a":null,"person_b":null,"seat_word":"table","event_word":"birthday","vip_tier_label":"Guests of honor"}'::jsonb,
   ARRAY['seating','budget','schedule','day_of','gallery'],
   'birthday','generic',NULL,NULL,NULL,NULL,NULL,NULL),
  ('celebration',
   '{"organizer_noun":"host","person_a":null,"person_b":null,"seat_word":"table","event_word":"celebration","vip_tier_label":"Guests of honor"}'::jsonb,
   ARRAY['seating','budget','schedule','day_of','gallery'],
   'celebration','generic',NULL,NULL,NULL,NULL,NULL,NULL),
  ('travel',
   '{"organizer_noun":"organizer","person_a":null,"person_b":null,"seat_word":"seat","event_word":"trip","vip_tier_label":"Travelers"}'::jsonb,
   ARRAY['seating','budget','schedule','day_of','gallery'],
   'travel','generic',NULL,NULL,NULL,NULL,NULL,NULL),
  ('corporate',
   '{"organizer_noun":"organizer","person_a":null,"person_b":null,"seat_word":"table","event_word":"event","vip_tier_label":"VIP guests"}'::jsonb,
   ARRAY['seating','budget','schedule','day_of','gallery'],
   'corporate','generic',NULL,NULL,NULL,NULL,NULL,NULL),
  ('tournament',
   '{"organizer_noun":"organizer","person_a":null,"person_b":null,"seat_word":"seat","event_word":"tournament","vip_tier_label":"VIP guests"}'::jsonb,
   ARRAY['seating','budget','schedule','day_of','gallery'],
   'tournament','generic',NULL,NULL,NULL,NULL,NULL,NULL),
  ('christening',
   '{"organizer_noun":"host","person_a":null,"person_b":null,"seat_word":"table","event_word":"christening","vip_tier_label":"Godparents"}'::jsonb,
   ARRAY['seating','budget','schedule','day_of','gallery'],
   'christening','generic',NULL,NULL,NULL,NULL,NULL,NULL)
ON CONFLICT (event_type) DO NOTHING;
