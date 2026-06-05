-- =============================================================================
-- 20260824000000_vendor_services_branch_id.sql
--
-- Iteration 0022 — Branches V1.x: branch-scoped service grouping. Lets an
-- Enterprise vendor with multiple branches assign each service to a branch, so
-- a multi-location business can organize its catalog per site. Agents inherit
-- branch scoping transitively — they're already scoped to specific services via
-- vendor_service_agents, and those services now carry a branch.
--
-- WHAT: a nullable branch_id on vendor_services (FK → vendor_branches, ON DELETE
-- SET NULL so deleting a branch un-assigns its services rather than orphaning).
-- NULL = "main / unassigned", which is every existing service — so this is
-- additive and changes nothing for the ~all vendors who have no branches.
--
-- RLS: unchanged. branch_id is an organizational column, not a security
-- boundary — vendor_services already gates owner/admin (current_vendor_profile_
-- ids) + agent-by-assignment. No policy touches needed.
-- =============================================================================

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS branch_id uuid
  REFERENCES public.vendor_branches(branch_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vendor_services_branch_id_idx
  ON public.vendor_services(branch_id)
  WHERE branch_id IS NOT NULL;
