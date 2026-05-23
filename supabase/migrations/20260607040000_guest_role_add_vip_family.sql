-- ============================================================================
-- 20260607040000_guest_role_add_vip_family.sql
--
-- Owner directive 2026-05-23 PM (verbatim): "add Role: Bride's Parents,
-- Groom's Parents, Bride's Immediate Family and Groom's Immediate Family.
-- these are VIP seating."
--
-- Adds four new values to the `guest_role` enum so the seating chart's
-- role-tier rings (per iteration 0008's auto-fill rule — Tier 1 = closest
-- to stage, including immediate family) can resolve VIP family
-- automatically.
--
-- Mirrors the pattern from 20260530020000_guest_role_add_bride_groom.sql
-- — `ALTER TYPE ... ADD VALUE IF NOT EXISTS` is idempotent + non-
-- destructive. No backfill: existing guests stay on whichever role they
-- had (typically `guest` if family wasn't an option before); hosts opt
-- their relatives into these new roles via the guest detail/edit page.
-- ============================================================================

BEGIN;

ALTER TYPE public.guest_role ADD VALUE IF NOT EXISTS 'bride_parents';
ALTER TYPE public.guest_role ADD VALUE IF NOT EXISTS 'groom_parents';
ALTER TYPE public.guest_role ADD VALUE IF NOT EXISTS 'bride_immediate_family';
ALTER TYPE public.guest_role ADD VALUE IF NOT EXISTS 'groom_immediate_family';

COMMIT;

-- ----------------------------------------------------------------------------
-- 2. Optional partial unique indexes (NOT shipped this migration).
-- ----------------------------------------------------------------------------
--
-- The bride/groom enum values get partial unique indexes via
-- 20260531010000_guests_unique_bride_groom_per_event.sql because there's
-- exactly ONE bride and ONE groom per event. The four new roles are
-- intentionally NOT single-instance — a wedding has TWO parents per side
-- (mother + father, sometimes step-parents) and ANY number of immediate
-- family members (siblings, sometimes grandparents). No partial unique
-- index needed; the host attaches as many as apply.
