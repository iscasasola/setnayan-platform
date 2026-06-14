-- ============================================================================
-- 20261205000000_event_type_vocab_dynamic.sql
--
-- Event types become fully ADMIN-DRIVEN (owner directive 2026-06-13): the
-- owner creates a new event type from Setnayan HQ (/admin/event-types) and
-- the create-event picker, the vendor "event types you serve" checkboxes,
-- the marketplace ?event_type= filter, and the /admin/taxonomy applicability
-- checkboxes all pick it up automatically — zero engineering, zero migration.
--
-- WHY: the roster was hardcoded in FIVE places (event-types.ts,
-- create-event/actions.ts ALLOWED_TYPES, vendor-dashboard actions + profile,
-- vendors/actions.ts + vendors/page.tsx) PLUS a Postgres ENUM
-- (public.event_type) PLUS two hardcoded CHECK constraints — and they had
-- ALREADY drifted: event_type_vocab + the enum carry anniversary /
-- graduation / reunion (migrations 20261104000000 + 20260805000000) that no
-- app surface knows about. The taxonomy is already vocab-driven (#1224 /
-- #1226 lineage); this migration makes `event_type_vocab` the single source
-- for the event-type roster everywhere.
--
--   1. event_type_vocab grows the presentation columns the pickers need
--      (emoji · enabled · onboarding_href · hero_photo_url · description).
--      `enabled` = appears in the couple-side create-event picker (the
--      launch lever); `status` stays the active/retired lifecycle field.
--      Vendors may declare coverage for any ACTIVE type even while
--      enabled=FALSE (pre-tagging before a public unlock).
--   2. events.event_type converts ENUM → TEXT with an FK to the vocab.
--      Deliberately NOT a CHECK against status='active': retiring a type
--      must keep its historical events valid. Creation-time enforcement
--      (active AND enabled) lives in the create-event server action.
--   3. The two hardcoded CHECKs that would reject an admin-created type at
--      the DB layer (vendor_profiles_event_types_check, the
--      couple_event_type_notify_signups event_type CHECK) are replaced by
--      vocab-validating triggers (same survive-the-roster-change rationale
--      as validate_applicable_event_types in 20261104000000).
--   4. public.event_type (the ENUM) is DROPPED. Consumer audit (this repo's
--      full migration history, 2026-06-13): events.event_type was the ONLY
--      column of this type; no view selects events.event_type; no function
--      signature uses the type; the only other reference is a literal cast
--      in 20260607000000_seed_vendor_reviews.sql which runs BEFORE this
--      migration in timestamp order, so fresh-database replays stay valid.
--      The DROP runs inside this transaction — any unknown dependency in a
--      live database fails the migration atomically rather than corrupting.
--
-- Behavior-preserving on landing: the 9 live types seed enabled=TRUE with
-- their exact event-types.ts emojis/labels/taglines (wedding keeps
-- onboarding_href='/onboarding/wedding'); anniversary / graduation / reunion
-- seed enabled=FALSE so they STAY out of the picker until the owner flips
-- them from Setnayan HQ.
--
-- RLS: unchanged — event_type_vocab already has public read + is_admin()
-- write (20261104000000), which is exactly the contract the new admin CRUD
-- page needs.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Presentation + launch-lever columns on the vocab
-- ----------------------------------------------------------------------------

ALTER TABLE public.event_type_vocab
  ADD COLUMN IF NOT EXISTS emoji           TEXT NOT NULL DEFAULT '🎉',
  ADD COLUMN IF NOT EXISTS enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_href TEXT,
  ADD COLUMN IF NOT EXISTS hero_photo_url  TEXT,
  ADD COLUMN IF NOT EXISTS description     TEXT;

COMMENT ON COLUMN public.event_type_vocab.enabled IS
  'TRUE = appears in the couple-side create-event picker. The admin launch lever — independent of status (vendors may serve any ACTIVE type even when enabled=FALSE).';
COMMENT ON COLUMN public.event_type_vocab.onboarding_href IS
  'Optional tailored-onboarding route the picker jumps to (e.g. /onboarding/wedding). NULL = inline create-event name form.';
COMMENT ON COLUMN public.event_type_vocab.hero_photo_url IS
  'Optional hero/feel photo for the picker card. NULL = the app falls back to /event-types/{key}.webp, then a generic placeholder.';
COMMENT ON COLUMN public.event_type_vocab.description IS
  'One-line tagline shown on the picker card (e.g. "The day you say I do.").';

-- Seed/realign the 9 live types — byte-identical to the (now retired)
-- EVENT_TYPES constant in event-types.ts, taglines from
-- event-type-photo-picker.tsx, sort_order realigned to the LIVE picker order
-- (wedding · debut · gender_reveal · birthday · celebration · travel ·
-- corporate · tournament · christening) so the cutover is visually
-- byte-identical. Idempotent UPDATEs (PK rows exist since 20261104000000;
-- the INSERTs below are a fresh-DB belt-and-suspenders).
INSERT INTO public.event_type_vocab (event_type, label_en, sort_order) VALUES
  ('wedding','Wedding',1),('birthday','Birthday',2),('celebration','Celebration',3),
  ('travel','Travel',4),('corporate','Corporate',5),('tournament','Tournament',6),
  ('christening','Christening',7),('gender_reveal','Gender Reveal',8),('debut','Debut',9),
  ('anniversary','Anniversary',10),('graduation','Graduation',11),('reunion','Reunion',12)
ON CONFLICT (event_type) DO NOTHING;

UPDATE public.event_type_vocab SET emoji='💍', enabled=TRUE, onboarding_href='/onboarding/wedding',
  description='The day you say "I do."', sort_order=1, updated_at=now() WHERE event_type='wedding';
UPDATE public.event_type_vocab SET emoji='👑', enabled=TRUE,
  description='Her grand eighteenth.', sort_order=2, updated_at=now() WHERE event_type='debut';
UPDATE public.event_type_vocab SET emoji='🎈', enabled=TRUE,
  description='Pink or blue?', sort_order=3, updated_at=now() WHERE event_type='gender_reveal';
UPDATE public.event_type_vocab SET emoji='🎂', enabled=TRUE,
  description='Another year, celebrated.', sort_order=4, updated_at=now() WHERE event_type='birthday';
UPDATE public.event_type_vocab SET emoji='🥂', enabled=TRUE,
  description='Moments worth gathering for.', sort_order=5, updated_at=now() WHERE event_type='celebration';
UPDATE public.event_type_vocab SET emoji='✈️', enabled=TRUE,
  description='The trip you''ll always remember.', sort_order=6, updated_at=now() WHERE event_type='travel';
UPDATE public.event_type_vocab SET emoji='🏢', enabled=TRUE,
  description='Where your brand shines.', sort_order=7, updated_at=now() WHERE event_type='corporate';
UPDATE public.event_type_vocab SET emoji='🏆', enabled=TRUE,
  description='Game day, elevated.', sort_order=8, updated_at=now() WHERE event_type='tournament';
UPDATE public.event_type_vocab SET emoji='🕯️', enabled=TRUE,
  description='A blessing to remember.', sort_order=9, updated_at=now() WHERE event_type='christening';
-- Not yet launched — visible to vendors (active) but NOT in the couple picker.
UPDATE public.event_type_vocab SET emoji='💞', enabled=FALSE,
  description='Years together, honored.', sort_order=10, updated_at=now() WHERE event_type='anniversary';
UPDATE public.event_type_vocab SET emoji='🎓', enabled=FALSE,
  description='The tassel was worth it.', sort_order=11, updated_at=now() WHERE event_type='graduation';
UPDATE public.event_type_vocab SET emoji='🤝', enabled=FALSE,
  description='Back together again.', sort_order=12, updated_at=now() WHERE event_type='reunion';

-- ----------------------------------------------------------------------------
-- 2. events.event_type: ENUM → TEXT + FK to the vocab
-- ----------------------------------------------------------------------------
-- The events_wedding_fields_consistency CHECK (20260521080000) already
-- compares via event_type::text, so it re-parses cleanly against TEXT.

ALTER TABLE public.events ALTER COLUMN event_type DROP DEFAULT;
ALTER TABLE public.events
  ALTER COLUMN event_type TYPE TEXT USING event_type::text;
ALTER TABLE public.events ALTER COLUMN event_type SET DEFAULT 'wedding';

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_event_type_fkey;
ALTER TABLE public.events
  ADD CONSTRAINT events_event_type_fkey
  FOREIGN KEY (event_type) REFERENCES public.event_type_vocab(event_type);

-- ----------------------------------------------------------------------------
-- 3. Replace the two hardcoded-roster CHECKs with vocab triggers
-- ----------------------------------------------------------------------------

-- 3a. vendor_profiles.event_types — the 20260521090000 CHECK froze the
-- 9-value roster; an admin-created type would be un-servable by vendors.
ALTER TABLE public.vendor_profiles
  DROP CONSTRAINT IF EXISTS vendor_profiles_event_types_check;
-- Keep the never-empty invariant as a plain CHECK (roster-independent).
ALTER TABLE public.vendor_profiles
  DROP CONSTRAINT IF EXISTS vendor_profiles_event_types_nonempty;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_event_types_nonempty
  CHECK (cardinality(event_types) > 0);

CREATE OR REPLACE FUNCTION public.validate_vendor_event_types()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  bad TEXT;
BEGIN
  SELECT string_agg(et, ', ') INTO bad
    FROM unnest(NEW.event_types) AS et
   WHERE et NOT IN (SELECT event_type FROM public.event_type_vocab WHERE status = 'active');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'event_types has unknown or retired event type(s): %', bad;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_event_types_vendor_profiles ON public.vendor_profiles;
CREATE TRIGGER validate_event_types_vendor_profiles
  BEFORE INSERT OR UPDATE OF event_types ON public.vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_vendor_event_types();

-- 3b. couple_event_type_notify_signups.event_type — same frozen-roster CHECK
-- (20260522010000); the "notify me when X launches" form must accept any
-- active vocab type. Anonymous-table caveat: the unnamed inline CHECK got an
-- auto-generated name, so resolve it from the catalog before dropping.
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT c.conname INTO v_conname
    FROM pg_constraint c
   WHERE c.conrelid = 'public.couple_event_type_notify_signups'::regclass
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) ILIKE '%event_type%'
   LIMIT 1;
  IF v_conname IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.couple_event_type_notify_signups DROP CONSTRAINT %I',
      v_conname
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.validate_notify_signup_event_type()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_type NOT IN
     (SELECT event_type FROM public.event_type_vocab WHERE status = 'active') THEN
    RAISE EXCEPTION 'unknown or retired event type: %', NEW.event_type;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_event_type_notify_signups
  ON public.couple_event_type_notify_signups;
CREATE TRIGGER validate_event_type_notify_signups
  BEFORE INSERT OR UPDATE OF event_type ON public.couple_event_type_notify_signups
  FOR EACH ROW EXECUTE FUNCTION public.validate_notify_signup_event_type();

-- ----------------------------------------------------------------------------
-- 4. Drop the enum — events.event_type was its only consumer (audit above).
-- ----------------------------------------------------------------------------

DROP TYPE IF EXISTS public.event_type;

COMMENT ON TABLE public.event_type_vocab IS
  'THE event-type roster — single source for the create-event picker, vendor coverage, marketplace filter, and taxonomy applicability. Admin CRUD at /admin/event-types (Setnayan HQ). enabled = couple-side picker visibility; status retired = no new picks, historical events stay valid (FK, no active CHECK).';

COMMIT;
