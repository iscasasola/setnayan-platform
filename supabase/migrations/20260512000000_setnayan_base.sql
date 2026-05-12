-- ============================================================================
-- 20260512000000_setnayan_base.sql
-- Sprint 0 canonical schema for Setnayan V1.
--
-- Anchors:
--   02_Specifications/Account_ID_Format.md  (S89X- generator)
--   02_Specifications/RLS_Policy_Pattern.md (8 patterns, 4 helper functions)
--   CLAUDE.md decision log (users.account_type, events.event_type, etc.)
--
-- This migration owns:
--   1. generate_public_id(type_letter)
--   2. account_type / event_type / member_type enums
--   3. users / events / event_members / event_join_tokens
--   4. is_admin() / current_event_ids() / current_vendor_ids() / current_thread_ids()
--   5. RLS policies (Pattern A for users, Pattern B for the rest)
--   6. on_auth_user_created trigger + § 10a internal-flag auto-issuance
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. generate_public_id(type_letter)
--    Crockford base 32 (no I/L/O/U) per Account_ID_Format.md.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_public_id(type_letter CHAR(1))
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet TEXT := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  body TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..10 LOOP
    body := body || substr(alphabet, 1 + (random() * 31)::INT, 1);
  END LOOP;
  RETURN 'S89' || upper(type_letter) || '-' || body;
END;
$$;

COMMENT ON FUNCTION public.generate_public_id IS
  'Generates a S89<TYPE>-<10-char Crockford base 32> public identifier.';

-- ----------------------------------------------------------------------------
-- 2. Enums
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('customer', 'vendor', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.event_type AS ENUM (
    'wedding', 'birthday', 'celebration', 'travel', 'corporate', 'burial'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.member_type AS ENUM ('couple', 'guest', 'vendor', 'coordinator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.locale_code AS ENUM ('en', 'tl', 'ceb');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.theme_preference AS ENUM (
    'setnayan_default', 'victorian', 'classy', 'ios'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 3. users
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id                BIGSERIAL PRIMARY KEY,
  user_id           UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  public_id         TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('U'),
  email             TEXT NOT NULL,
  display_name      TEXT,
  account_type      public.account_type NOT NULL DEFAULT 'customer',
  is_internal       BOOLEAN NOT NULL DEFAULT FALSE,
  is_team_member    BOOLEAN NOT NULL DEFAULT FALSE,
  locale            public.locale_code NOT NULL DEFAULT 'en',
  theme_preference  public.theme_preference NOT NULL DEFAULT 'setnayan_default',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_user_id_idx ON public.users(user_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_account_type_idx ON public.users(account_type);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. events
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.events (
  id                   BIGSERIAL PRIMARY KEY,
  event_id             UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  public_id            TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('E'),
  event_type           public.event_type NOT NULL DEFAULT 'wedding',
  display_name         TEXT NOT NULL,
  event_date           DATE,
  is_primary           BOOLEAN NOT NULL DEFAULT FALSE,
  archived             BOOLEAN NOT NULL DEFAULT FALSE,
  geolocation_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_event_id_idx ON public.events(event_id);
CREATE INDEX IF NOT EXISTS events_event_type_idx ON public.events(event_type);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5. event_members
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_members (
  id           BIGSERIAL PRIMARY KEY,
  event_id     UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_type  public.member_type NOT NULL,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_members_event_id_idx ON public.event_members(event_id);
CREATE INDEX IF NOT EXISTS event_members_user_id_idx ON public.event_members(user_id);

ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 6. event_join_tokens
--    Per 0000 spec: one active token per event; couples rotate; redemption
--    happens via a service-role Edge Function (not direct RLS write).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_join_tokens (
  id           BIGSERIAL PRIMARY KEY,
  event_id     UUID NOT NULL UNIQUE REFERENCES public.events(event_id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_join_tokens_token_idx ON public.event_join_tokens(token);

ALTER TABLE public.event_join_tokens ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 7. Helper functions — SECURITY DEFINER STABLE
--    Run as the function owner; STABLE lets PostgreSQL cache the result within
--    a single statement so a 200-row SELECT resolves each helper exactly once.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE user_id = auth.uid()
      AND account_type = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_event_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT event_id FROM public.event_members
  WHERE user_id = auth.uid();
$$;

-- Stub helpers — vendor_team_members and chat_thread_participants land in
-- iterations 0022 and 0019 respectively. Defined here so RLS policies that
-- reference them don't have to be retrofitted later.
CREATE OR REPLACE FUNCTION public.current_vendor_ids(min_role TEXT DEFAULT 'viewer')
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- vendor_team_members is created by iteration 0022.
  SELECT NULL::UUID WHERE min_role IS NOT NULL AND FALSE;
$$;

CREATE OR REPLACE FUNCTION public.current_thread_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- chat_thread_participants is created by iteration 0019.
  SELECT NULL::UUID WHERE FALSE;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_event_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_vendor_ids(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_thread_ids() TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. RLS policies
--    users          — Pattern A (per-user) + admin override
--    events         — Pattern B (event-member read; couple/admin write)
--    event_members  — Pattern B (self-read + couple/admin write)
--    event_join_tokens — Pattern B (couple/admin manage; service-role redeems)
-- ----------------------------------------------------------------------------

-- users -----------------------------------------------------------------
DROP POLICY IF EXISTS user_owns_row ON public.users;
CREATE POLICY user_owns_row ON public.users
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS admin_full_access_users ON public.users;
CREATE POLICY admin_full_access_users ON public.users
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- events ----------------------------------------------------------------
DROP POLICY IF EXISTS event_member_can_read ON public.events;
CREATE POLICY event_member_can_read ON public.events
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

-- Any authenticated user may create an event. The application layer adds the
-- creator as the first event_members row with member_type='couple' inside
-- the same transaction (server action).
DROP POLICY IF EXISTS authenticated_can_create_event ON public.events;
CREATE POLICY authenticated_can_create_event ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS couple_can_update_event ON public.events;
CREATE POLICY couple_can_update_event ON public.events
  FOR UPDATE TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS couple_can_delete_event ON public.events;
CREATE POLICY couple_can_delete_event ON public.events
  FOR DELETE TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  );

-- event_members ---------------------------------------------------------
DROP POLICY IF EXISTS member_reads_membership ON public.event_members;
CREATE POLICY member_reads_membership ON public.event_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS member_can_self_join ON public.event_members;
CREATE POLICY member_can_self_join ON public.event_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS couple_can_update_member ON public.event_members;
CREATE POLICY couple_can_update_member ON public.event_members
  FOR UPDATE TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS couple_can_delete_member ON public.event_members;
CREATE POLICY couple_can_delete_member ON public.event_members
  FOR DELETE TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  );

-- event_join_tokens -----------------------------------------------------
DROP POLICY IF EXISTS couple_manages_join_token ON public.event_join_tokens;
CREATE POLICY couple_manages_join_token ON public.event_join_tokens
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

-- ----------------------------------------------------------------------------
-- 9. Auto-provision public.users + § 10a internal-flag on auth signup
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_internal BOOLEAN := FALSE;
BEGIN
  -- § 10a internal accounts auto-flag. Owner email hard-coded; spouse is
  -- flagged manually via the admin console once it ships (iteration 0023).
  IF NEW.email = 'iscasasolaii@gmail.com' THEN
    v_is_internal := TRUE;
  END IF;

  INSERT INTO public.users (user_id, email, account_type, is_internal)
  VALUES (NEW.id, NEW.email, 'customer', v_is_internal)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

COMMIT;
