-- phase2 person connections schema
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ============================================================================
-- Person-spine · PHASE 2 foundation · the connections graph (owner "complete
-- phase 2 now" 2026-07-05 — STAGED / flag-off).
--
-- ⚠ PHASE 2 IS COUNSEL-GATED. This migration ships the schema ONLY — an empty,
-- deny-by-default, additive table. NOTHING writes to it: the suggest→confirm
-- FLOW that populates it is built behind an OFF feature flag and MUST NOT go
-- live (i.e. store real relationship data) until PH counsel signs off. An empty
-- inert table carries no relationship data and no legal exposure — same posture
-- as the Phase-1 `people` table. Plan: 03_Strategy/People_Graph_and_Lifelong_
-- Identity_2026-07-04.md §11.
--
-- Model (locked): FAMILY is first-degree only — spouse · parent · sibling ·
-- child (extended kin DERIVED, never stored). RITUAL kinship = godparent /
-- godchild (ninong/ninang, EVENT-created). FRIEND = a lighter co-presence edge.
-- Every edge is MUTUALLY CONFIRMED (status pending→confirmed) and ADULTS-FIRST
-- (minor children/godchildren = Phase 3, guardian-held).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.person_connections (
  id                  BIGSERIAL PRIMARY KEY,                                   -- hidden internal join key
  connection_id       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),          -- edge id (internal — connections aren't shared entities, so no S89 public_id)
  from_person_id      UUID NOT NULL REFERENCES public.people(person_id) ON DELETE CASCADE,  -- who declared the edge
  to_person_id        UUID NOT NULL REFERENCES public.people(person_id) ON DELETE CASCADE,  -- the other person
  -- what to_person IS to from_person, from from_person's declaration. The inverse
  -- (parent↔child, godparent↔godchild) is DERIVED in code, not stored twice.
  relation            TEXT NOT NULL CHECK (relation IN ('spouse','parent','child','sibling','godparent','godchild','friend')),
  layer               TEXT NOT NULL CHECK (layer IN ('family','ritual','friend')),  -- blood/affinal · ritual-kinship · friend
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','declined')),
  created_by_event_id UUID REFERENCES public.events(event_id) ON DELETE SET NULL,  -- the ceremony that created it (kasal/binyag/kumpil), if any
  created_by_user_id  UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  confirmed_at        TIMESTAMPTZ,
  declined_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  CONSTRAINT person_connections_no_self CHECK (from_person_id <> to_person_id)
);

COMMENT ON TABLE public.person_connections IS
  'Person-spine PHASE 2 connections graph (counsel-gated; empty/inert until the flag-gated flow is cleared to go live). Directed edges: relation = what to_person is to from_person. Mutually confirmed (status). Family first-degree only; extended kin derived. Ritual kinship = godparent/godchild (event-created). Adults-first; minors = Phase 3.';

-- One edge per (from, to, relation) — no duplicate declarations.
CREATE UNIQUE INDEX IF NOT EXISTS person_connections_edge_uniq
  ON public.person_connections (from_person_id, to_person_id, relation) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS person_connections_from_idx ON public.person_connections (from_person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS person_connections_to_idx   ON public.person_connections (to_person_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.person_connections_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS person_connections_set_updated_at ON public.person_connections;
CREATE TRIGGER person_connections_set_updated_at
  BEFORE UPDATE ON public.person_connections
  FOR EACH ROW EXECUTE FUNCTION public.person_connections_set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — private to the two people in the edge (+ admin), deny-by-default. The
-- graph is NEVER browsable: only the participants (the account that claims
-- from_person or to_person) can see or act on their own edges. `is_admin()` for
-- ops. (The flow layer will use scoped server actions for propose/confirm; this
-- is the safety net.)
-- ----------------------------------------------------------------------------
ALTER TABLE public.person_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS person_connections_participant ON public.person_connections;
CREATE POLICY person_connections_participant ON public.person_connections
  FOR ALL
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.people p WHERE p.person_id = person_connections.from_person_id AND p.claimed_by_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.people p WHERE p.person_id = person_connections.to_person_id   AND p.claimed_by_user_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.people p WHERE p.person_id = person_connections.from_person_id AND p.claimed_by_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.people p WHERE p.person_id = person_connections.to_person_id   AND p.claimed_by_user_id = auth.uid())
  );
