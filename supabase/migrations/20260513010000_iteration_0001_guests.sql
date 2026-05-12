-- ============================================================================
-- 20260513010000_iteration_0001_guests.sql
-- Iteration 0001 — Guest list management.
--
-- Schema basis for the couple's master guest list. Pairs with iteration 0000:
-- event_members.guest_id (forward-compat in 0000) now gets its FK to public.guests.
--
-- Includes:
--   - Filipino-wedding role enum (18 values from spec § Role taxonomy)
--   - 5 supporting enums (side, group_category, meal_preference, rsvp_status,
--     plus_one_mode)
--   - households table
--   - guests table with soft-delete + plus-one columns + photo_consent +
--     invited_to_blocks + custom_tags + per-guest qr_token
--   - RLS Pattern B (event-scoped, couples write, all members read)
--   - generated public_id S89G-XXXXXXXXXX for guests
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.guest_role AS ENUM (
    'guest',
    'maid_of_honor',
    'matron_of_honor',
    'best_man',
    'bridesmaid',
    'groomsman',
    'principal_sponsor',   -- Ninong / Ninang
    'candle_sponsor',
    'veil_sponsor',
    'cord_sponsor',
    'coin_sponsor',        -- Arrhae sponsor
    'ring_bearer',
    'bible_bearer',
    'coin_bearer',
    'flower_girl',
    'officiant',
    'reader_lector',
    'soloist_musician'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.guest_side AS ENUM ('bride', 'groom', 'both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.guest_group_category AS ENUM (
    'family', 'friends', 'work', 'school', 'officiant', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.meal_preference AS ENUM (
    'beef', 'chicken', 'fish', 'vegetarian', 'vegan', 'kids', 'no_preference'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rsvp_status AS ENUM (
    'pending', 'attending', 'declined', 'maybe'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.plus_one_mode AS ENUM ('full', 'limited');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. households (internal entity — no public_id surface)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.households (
  id            BIGSERIAL PRIMARY KEY,
  household_id  UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  address       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS households_event_id_idx ON public.households(event_id);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. guests
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.guests (
  id                   BIGSERIAL PRIMARY KEY,
  guest_id             UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  public_id            TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('G'),
  event_id             UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  household_id         UUID REFERENCES public.households(household_id) ON DELETE SET NULL,
  pair_with_guest_id   UUID REFERENCES public.guests(guest_id) ON DELETE SET NULL,
  first_name           TEXT NOT NULL,
  last_name            TEXT NOT NULL,
  display_name         TEXT,
  side                 public.guest_side NOT NULL,
  group_category       public.guest_group_category NOT NULL,
  role                 public.guest_role NOT NULL DEFAULT 'guest',
  plus_one_allowed     BOOLEAN NOT NULL DEFAULT FALSE,
  plus_one_name        TEXT,
  plus_one_of_guest_id UUID REFERENCES public.guests(guest_id) ON DELETE SET NULL,
  plus_one_mode        public.plus_one_mode,
  email                TEXT,
  mobile               TEXT,
  address              JSONB,
  meal_preference      public.meal_preference,
  dietary_restrictions TEXT,
  photo_consent        BOOLEAN NOT NULL DEFAULT TRUE,
  invited_to_blocks    TEXT[] NOT NULL DEFAULT ARRAY['ceremony', 'reception']::TEXT[],
  custom_tags          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  rsvp_status          public.rsvp_status NOT NULL DEFAULT 'pending',
  rsvp_responded_at    TIMESTAMPTZ,
  invitation_sent_at   TIMESTAMPTZ,
  notes                TEXT,
  qr_token             TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guests_event_id_idx ON public.guests(event_id);
CREATE INDEX IF NOT EXISTS guests_event_rsvp_idx ON public.guests(event_id, rsvp_status);
CREATE INDEX IF NOT EXISTS guests_event_role_idx ON public.guests(event_id, role);
CREATE INDEX IF NOT EXISTS guests_household_idx ON public.guests(household_id);
CREATE INDEX IF NOT EXISTS guests_qr_token_idx ON public.guests(qr_token);
CREATE INDEX IF NOT EXISTS guests_active_idx ON public.guests(event_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS guests_plus_one_of_idx ON public.guests(plus_one_of_guest_id) WHERE plus_one_of_guest_id IS NOT NULL;

ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. Hook up the forward-compat FK from event_members.guest_id
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'event_members_guest_id_fkey'
      AND table_name = 'event_members'
  ) THEN
    ALTER TABLE public.event_members
      ADD CONSTRAINT event_members_guest_id_fkey
      FOREIGN KEY (guest_id) REFERENCES public.guests(guest_id) ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. RLS — Pattern B (event-scoped collaborative) on both tables
-- ----------------------------------------------------------------------------

-- households -------------------------------------------------------------
DROP POLICY IF EXISTS event_member_can_read_household ON public.households;
CREATE POLICY event_member_can_read_household ON public.households
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

DROP POLICY IF EXISTS couple_writes_household ON public.households;
CREATE POLICY couple_writes_household ON public.households
  FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  );

-- guests -----------------------------------------------------------------
DROP POLICY IF EXISTS event_member_can_read_guest ON public.guests;
CREATE POLICY event_member_can_read_guest ON public.guests
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS couple_writes_guest ON public.guests;
CREATE POLICY couple_writes_guest ON public.guests
  FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  );

-- guests RLS reading own row (a registered guest can see their own row even
-- if they're not a couple, useful when 0002 invitation site renders)
DROP POLICY IF EXISTS guest_reads_own_row ON public.guests;
CREATE POLICY guest_reads_own_row ON public.guests
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND guest_id IN (
      SELECT em.guest_id
      FROM public.event_members em
      WHERE em.user_id = auth.uid()
        AND em.guest_id IS NOT NULL
    )
  );

COMMIT;
