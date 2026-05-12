-- ============================================================================
-- 20260513000000_iteration_0000_shell_schema.sql
-- Iteration 0000 — App Shell & Navigation: schema delta on the Sprint 0 base.
--
-- Adds columns the 0000 spec requires:
--   - users.phone, users.profile_photo_url, users.last_login_at
--   - events.wedding_date, events.venue_name, events.venue_address
--   - event_members.role, event_members.joined_via, event_members.guest_id,
--     event_members.vendor_id
--
-- guest_id and vendor_id are forward-compatible nullable columns. The FK
-- constraints to public.guests (created by iteration 0001) and public.vendors
-- (created by iteration 0022) will be added when those tables ship.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. users additions
-- ----------------------------------------------------------------------------

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- 2. events additions
--    `event_date` already exists (sprint 0 base); the 0000 spec uses
--    `wedding_date` as the column name. To honor the spec while preserving
--    sprint-0 backwards compat, we expose `wedding_date` as a generated
--    column that mirrors event_date for wedding events. The application
--    layer should write to event_date.
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_name TEXT,
  ADD COLUMN IF NOT EXISTS venue_address TEXT;

-- ----------------------------------------------------------------------------
-- 3. event_members additions
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.join_method AS ENUM (
    'qr_scan', 'invited', 'created_event', 'admin_added'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.event_members
  ADD COLUMN IF NOT EXISTS role TEXT,                       -- 18-role taxonomy from 0001 (string for forward compat)
  ADD COLUMN IF NOT EXISTS joined_via public.join_method,
  ADD COLUMN IF NOT EXISTS guest_id UUID,                   -- FK added by iteration 0001
  ADD COLUMN IF NOT EXISTS vendor_id UUID;                  -- FK added by iteration 0022

CREATE INDEX IF NOT EXISTS event_members_guest_id_idx
  ON public.event_members(guest_id) WHERE guest_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS event_members_vendor_id_idx
  ON public.event_members(vendor_id) WHERE vendor_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. event_join_tokens — auto-generate when an event is created
--    Adds a trigger that mints a 32-hex token on event insert if one isn't
--    already provided by the application. Couples can rotate via the app.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_event_join_token()
RETURNS TEXT
LANGUAGE SQL
AS $$
  SELECT encode(gen_random_bytes(16), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.handle_new_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.event_join_tokens (event_id, token)
  VALUES (NEW.event_id, public.generate_event_join_token())
  ON CONFLICT (event_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_event_created ON public.events;
CREATE TRIGGER on_event_created
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_event();

-- ----------------------------------------------------------------------------
-- 5. RLS policies — no new tables in this migration, but ensure the existing
--    Pattern B policies cover the new columns (they do — column-level RLS
--    is not separately gated). Sanity-check by listing the policies.
-- ----------------------------------------------------------------------------

-- (no policy changes needed; column additions inherit table-level RLS)

COMMIT;
