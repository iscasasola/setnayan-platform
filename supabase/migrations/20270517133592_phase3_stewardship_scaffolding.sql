-- phase3 stewardship scaffolding
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • CREATE INDEX IF NOT EXISTS …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …

-- ============================================================================
-- Person-spine · PHASE 3 · STEWARDED ("BRANCH") ACCOUNTS — INERT SCAFFOLDING
-- ONLY (owner "proceed with the build" 2026-07-05).
--
-- ⚠⚠ PHASE 3 IS COUNSEL-FIRST AND TOUCHES MINORS + POST-MORTEM/SUCCESSION LAW.
-- This migration ships EMPTY, ADDITIVE, DENY-BY-DEFAULT tables ONLY — Step 1 of
-- 03_Strategy/Stewarded_Branch_Accounts_Phase3_Design_2026-07-05.md §6. It
-- creates NO behavior, NO triggers, NO functions, and processes NO data. A
-- guardian branch cannot be created and no transfer can occur from this schema
-- alone — that flow is BUILD-GATED behind PH counsel + DPO (Claire E. Buanhog)
-- sign-off and its own DPIA (minors + post-mortem each warrant one). An empty
-- inert table carries no minor data and no legal exposure — same posture as the
-- Phase-2 person_connections / person_story_items schema that shipped ahead of
-- its flow.
--
-- The one primitive (locked): a "branch" is a people node held by a STEWARD
-- (guardian OR estate) whose OWNERSHIP is transferable — minor → guardian-held →
-- transfers at majority (18); deceased → direct-line heir/memorial. Ownership
-- itself lives on people.claimed_by_user_id; these tables record WHO stewards a
-- branch and the AUDIT of any future transfer.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. person_stewardships — who currently stewards a branch node (empty/inert)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.person_stewardships (
  id                 BIGSERIAL PRIMARY KEY,
  stewardship_id     UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  branch_person_id   UUID NOT NULL REFERENCES public.people(person_id) ON DELETE CASCADE,   -- the ward/legacy node
  steward_user_id    UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,      -- who controls it (guardian/estate)
  kind               TEXT NOT NULL CHECK (kind IN ('guardian','estate')),                   -- minor guardian vs post-life estate
  is_minor           BOOLEAN NOT NULL DEFAULT FALSE,                                         -- wall-off signal (minors excluded from adult surfaces)
  basis              TEXT,                                                                   -- documented basis / proof reference (counsel-defined)
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','relinquished','revoked')),
  granted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at            TIMESTAMPTZ,        -- e.g. the ward's majority date
  relinquished_at    TIMESTAMPTZ,
  revoked_at         TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
  -- Tighter integrity (e.g. a person can't steward themselves, one active
  -- steward per branch) lands with the counsel-cleared flow, not this scaffold.
);

COMMENT ON TABLE public.person_stewardships IS
  'Person-spine PHASE 3 (COUNSEL-FIRST · minors + post-mortem) INERT SCAFFOLDING: records who stewards a branch people-node (guardian/estate). Empty + deny-by-default until PH counsel + DPO clear the flow + DPIA. No behavior ships from this schema; ownership itself is people.claimed_by_user_id.';

CREATE INDEX IF NOT EXISTS person_stewardships_branch_idx  ON public.person_stewardships (branch_person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS person_stewardships_steward_idx ON public.person_stewardships (steward_user_id)  WHERE deleted_at IS NULL;

ALTER TABLE public.person_stewardships ENABLE ROW LEVEL SECURITY;

-- Deny-by-default: only the steward for a row (or an admin) may see/act. No
-- browse, no cross-steward visibility. (The real, tighter flow-time policies
-- land with the counsel-cleared build.)
DROP POLICY IF EXISTS person_stewardships_steward_or_admin ON public.person_stewardships;
CREATE POLICY person_stewardships_steward_or_admin ON public.person_stewardships
  FOR ALL
  USING (public.is_admin() OR steward_user_id = auth.uid())
  WITH CHECK (public.is_admin() OR steward_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. stewardship_transfers — append-only AUDIT of any ownership transfer
--    (majority / inheritance / revocation). Empty/inert.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stewardship_transfers (
  id                 BIGSERIAL PRIMARY KEY,
  transfer_id        UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  stewardship_id     UUID REFERENCES public.person_stewardships(stewardship_id) ON DELETE SET NULL,
  branch_person_id   UUID NOT NULL REFERENCES public.people(person_id) ON DELETE CASCADE,
  from_user_id       UUID REFERENCES public.users(user_id) ON DELETE SET NULL,   -- relinquishing steward
  to_user_id         UUID REFERENCES public.users(user_id) ON DELETE SET NULL,   -- new owner / heir claimant
  transfer_kind      TEXT NOT NULL CHECK (transfer_kind IN ('majority','inheritance','revocation')),
  verification_ref   TEXT,                                                       -- proof reference (counsel-defined bar)
  status             TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','verified','completed','rejected')),
  initiated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at       TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stewardship_transfers IS
  'Person-spine PHASE 3 INERT SCAFFOLDING: append-only audit of a branch ownership transfer (majority/inheritance/revocation). Empty + deny-by-default until the counsel-cleared flow ships. Immutable by design — no UPDATE/DELETE policy.';

CREATE INDEX IF NOT EXISTS stewardship_transfers_branch_idx ON public.stewardship_transfers (branch_person_id);
CREATE INDEX IF NOT EXISTS stewardship_transfers_stewardship_idx ON public.stewardship_transfers (stewardship_id);

ALTER TABLE public.stewardship_transfers ENABLE ROW LEVEL SECURITY;

-- Deny-by-default: a participant (relinquishing steward or claimant) or an admin
-- may READ; nobody gets UPDATE/DELETE (append-only audit). INSERT is left to the
-- counsel-cleared flow (service-role / SECURITY DEFINER), not open to clients.
DROP POLICY IF EXISTS stewardship_transfers_participant_read ON public.stewardship_transfers;
CREATE POLICY stewardship_transfers_participant_read ON public.stewardship_transfers
  FOR SELECT
  USING (public.is_admin() OR from_user_id = auth.uid() OR to_user_id = auth.uid());
