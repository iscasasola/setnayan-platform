-- person spine people table
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ============================================================================
-- Person-spine model · Phase 1 foundation (owner-locked "lock everything"
-- 2026-07-04 · 03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md).
--
-- `people` is the DURABLE person node: a Person exists whether or not it is
-- ever claimed by a login. An account CLAIMS a Person (1:1) via
-- claimed_by_user_id; most Persons stay unclaimed (a guest, a relative, a lola
-- who never signs up). This migration is ADDITIVE and ADULTS-FIRST — it creates
-- the node table only. It seeds NO data, alters no existing table, and adds no
-- connections. Connections (family tree · ninong/ninang · friends), life
-- stories, and legacy/memorialisation are Phase 2/3 — counsel-gated — and are
-- deliberately NOT in this migration.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.people (
  id                 BIGSERIAL PRIMARY KEY,                                    -- hidden internal join key
  person_id          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  public_id          TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('P'),  -- S89P-…
  display_name       TEXT,
  first_name         TEXT,
  last_name          TEXT,
  email              TEXT,                                                     -- match-on-signup anchor (strongest signal)
  phone              TEXT,
  profile_photo_url  TEXT,
  birth_date         DATE,                                                     -- powers the adults-only gate for Phase-2 connections
  claimed_by_user_id UUID UNIQUE REFERENCES public.users(user_id) ON DELETE SET NULL,  -- NULL = unclaimed; one account claims <= 1 person
  created_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,         -- the host who added them (NULL = system)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);

COMMENT ON TABLE public.people IS
  'Person-spine durable node (owner-locked 2026-07-04). A Person exists with or without an account; an account CLAIMS a person via claimed_by_user_id (1:1). Phase-1 foundation - additive, adults-first. Connections / life-stories / legacy are Phase 2/3 (counsel-gated) and not represented here.';
COMMENT ON COLUMN public.people.claimed_by_user_id IS
  'The account that claimed this person (NULL = unclaimed guest/relative). UNIQUE: one account claims at most one person.';
COMMENT ON COLUMN public.people.birth_date IS
  'Optional. Gates the adults-only rule for Phase-2 connections; minors are Phase-3 (guardian-held, counsel-gated).';

-- updated_at maintenance (dedicated fn - no shared trigger fn convention exists).
CREATE OR REPLACE FUNCTION public.people_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS people_set_updated_at ON public.people;
CREATE TRIGGER people_set_updated_at
  BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.people_set_updated_at();

-- Indexes: the match-on-signup anchor (case-insensitive email) + ownership lookups.
CREATE INDEX IF NOT EXISTS people_email_lower_idx
  ON public.people (lower(email)) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS people_created_by_idx
  ON public.people (created_by_user_id) WHERE created_by_user_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- RLS - owner-only + admin, deny-by-default (RLS enabled in the SAME migration
-- as CREATE TABLE, per the canonical pattern). A person node is visible only to
-- the account that CLAIMED it, the account that CREATED it, or an admin. The
-- graph is private; broader visibility (who can see whom) is a Phase-2 concern
-- with its own connections table + policies.
-- ----------------------------------------------------------------------------
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS people_owner_all ON public.people;
CREATE POLICY people_owner_all ON public.people
  FOR ALL
  USING (claimed_by_user_id = auth.uid() OR created_by_user_id = auth.uid())
  WITH CHECK (claimed_by_user_id = auth.uid() OR created_by_user_id = auth.uid());

DROP POLICY IF EXISTS people_admin_all ON public.people;
CREATE POLICY people_admin_all ON public.people
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
