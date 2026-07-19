-- ============================================================================
-- 20270819300000_communities_drop_kind.sql
--
-- Drop the samahan KIND taxonomy (owner 2026-07-17: "remove parish … there is
-- no specific samahan — they just name the group"). A samahan is only a
-- user-chosen name; the app never classifies it.
--
-- Privacy by design (RA 10173): the structured 'parish' kind made membership a
-- religious-affiliation signal — §3(l)-adjacent sensitive PI the platform had
-- no need to hold. A free-text NAME the group chooses for itself is the
-- group's own speech; a classification column was ours. Removing the column
-- (not just the option) means no future query, export, or breach can enumerate
-- "members of parish-type groups".
--
-- The communities table is EMPTY in production (verified 2026-07-17) — no data
-- is lost. Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.communities DROP CONSTRAINT IF EXISTS communities_kind_check;
ALTER TABLE public.communities DROP COLUMN IF EXISTS kind;

COMMENT ON TABLE public.communities IS
  'Samahan — user-named groups (barkada, clan, org, anything). NO kind/classification column by design (owner 2026-07-17): the name is the group''s own choice; the platform never categorizes affiliation (RA 10173 data minimization).';

COMMIT;
