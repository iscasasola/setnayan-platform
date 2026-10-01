-- ============================================================================
-- THE EVENT-TYPE PROFILE CARRIES THE SETUP (G1 · the event onboarding engine)
-- ============================================================================
--
-- Owner, 2026-09-30 (DECISION_LOG "APPROVED — THE EVENT ONBOARDING CONCEPT"):
-- the type × feature matrix lives as "five new fields on the existing
-- event-type profile (guest word · gifts mode · team first · look set · camera
-- default)" — never a second table. These are those five, on the same row.
--
--   guest_word      what the type calls the people it invites
--                   (guests · attendees · travellers · players · family & friends)
--   gifts_mode      gifts · donations · abuloy · ambag · none
--   team_first      the ordered first supplier suggestions (service_categories ids)
--   look_set        the type's Event Hub themes, its own first (invite_theme ids)
--   camera_default  on · quiet · off (Papic's starting posture)
--
-- 🔑 A SEEDED `look_set` IS WHAT ADMITS A TYPE TO THE ONBOARDING ENGINE.
-- lib/event-type-profile.ts reads `onboardingEngine` as "this row carries a
-- look set". So this migration seeds exactly the five types of the first build
-- (DECISION_LOG "BUILD ORDER FOR THE SIMPLIFICATION": wedding + the simple
-- types — birthday · hangout · date · get-together = simple_event). Wake,
-- corporate and the rest keep NULL and keep yesterday's onboarding until their
-- own seed (G5) — the data decides, never a type-name list in code.
--
-- Roles follow the type too (DECISION_LOG "GUEST-LIST ROLES AND GROUPS FOLLOW
-- THE EVENT TYPE"): birthday → the 'birthday' role set (celebrant · host ·
-- family · guest), hangout and date → 'hangout' (host · guest). Measured in
-- production before writing this: ZERO guests on any birthday, hangout or date
-- event, so no stored role is stranded by the narrower pickers.
--
-- Nullable, no CHECK on the text columns: the code reads each one strictly and
-- falls back per field (toProfile), the same degrade-to-yesterday contract as
-- every other profile column. RLS is unchanged (the table already has it).
-- Idempotent.
-- ============================================================================

ALTER TABLE public.event_type_profiles ADD COLUMN IF NOT EXISTS guest_word TEXT;
ALTER TABLE public.event_type_profiles ADD COLUMN IF NOT EXISTS gifts_mode TEXT;
ALTER TABLE public.event_type_profiles ADD COLUMN IF NOT EXISTS team_first TEXT[];
ALTER TABLE public.event_type_profiles ADD COLUMN IF NOT EXISTS look_set TEXT[];
ALTER TABLE public.event_type_profiles ADD COLUMN IF NOT EXISTS camera_default TEXT;

-- The matrix M seed (prototypes/event_onboarding_concept_2026-09-30_fable.html).
UPDATE public.event_type_profiles SET
  guest_word = 'guests',
  gifts_mode = 'gifts',
  team_first = ARRAY['venue','catering','photo_video','coordinator','florist','stylist_decorator','hmua','cake'],
  look_set = ARRAY['velvet','vintage','regency','cinderella'],
  camera_default = 'on'
WHERE event_type = 'wedding';

UPDATE public.event_type_profiles SET
  guest_word = 'guests',
  gifts_mode = 'gifts',
  team_first = ARRAY['cake','host_mc','venue','catering','photo_booth','stylist_decorator'],
  look_set = ARRAY['whimsical','abaca','house','galeriya'],
  camera_default = 'on',
  role_set_key = 'birthday'
WHERE event_type = 'birthday';

UPDATE public.event_type_profiles SET
  guest_word = 'guests',
  gifts_mode = 'none',
  team_first = ARRAY['restaurant_reservation','photo_video','performers'],
  look_set = ARRAY['house','galeriya','cyber'],
  camera_default = 'on',
  role_set_key = 'hangout'
WHERE event_type IN ('hangout', 'date');

-- "Get-together" = simple_event (owner, 2026-09-30). Marketplace is off, so
-- there is no supplier to suggest first.
UPDATE public.event_type_profiles SET
  guest_word = 'guests',
  gifts_mode = 'none',
  team_first = ARRAY[]::TEXT[],
  look_set = ARRAY['house','galeriya','cyber'],
  camera_default = 'on'
WHERE event_type = 'simple_event';

-- The picker label (vocab data only, owner answer (2) of the approved concept).
UPDATE public.event_type_vocab SET label_en = 'Get-together'
WHERE event_type = 'simple_event';
