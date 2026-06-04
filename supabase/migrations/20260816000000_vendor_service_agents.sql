-- 20260816000000_vendor_service_agents.sql
-- Per-service agent scoping for the multi-user vendor workspace (Phase 2a).
--
-- Assigns an agent (a vendor_team_members row) to specific vendor_services so
-- the dashboard can later scope what an agent sees to their assigned services
-- + the customers tied to them (a couple's event_vendors.service_id points at
-- the booked vendor_services row). Owner/admin manage the assignments; any
-- member can read them (so an agent sees their own assignment).
--
-- RLS enabled at CREATE per the canonical pattern; gated through the existing
-- public.current_vendor_ids(min_role) helper so the role ranking (owner >
-- admin > agent > viewer) is the single source of truth.

CREATE TABLE IF NOT EXISTS public.vendor_service_agents (
  vendor_service_id      UUID NOT NULL
                         REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  vendor_team_member_id  UUID NOT NULL
                         REFERENCES public.vendor_team_members(vendor_team_member_id) ON DELETE CASCADE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_service_id, vendor_team_member_id)
);

CREATE INDEX IF NOT EXISTS vendor_service_agents_member_idx
  ON public.vendor_service_agents (vendor_team_member_id);

ALTER TABLE public.vendor_service_agents ENABLE ROW LEVEL SECURITY;

-- READ — any member of the owning vendor can see the assignment rows (so an
-- agent reads their own assignments and owner/admin read the whole map).
DROP POLICY IF EXISTS vendor_service_agents_member_read ON public.vendor_service_agents;
CREATE POLICY vendor_service_agents_member_read
  ON public.vendor_service_agents FOR SELECT
  TO authenticated
  USING (
    vendor_service_id IN (
      SELECT vs.vendor_service_id
      FROM public.vendor_services vs
      WHERE vs.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
    )
  );

-- WRITE — only owner/admin of the owning vendor manage assignments.
DROP POLICY IF EXISTS vendor_service_agents_manage ON public.vendor_service_agents;
CREATE POLICY vendor_service_agents_manage
  ON public.vendor_service_agents FOR ALL
  TO authenticated
  USING (
    vendor_service_id IN (
      SELECT vs.vendor_service_id
      FROM public.vendor_services vs
      WHERE vs.vendor_profile_id IN (SELECT public.current_vendor_ids('admin'))
    )
  )
  WITH CHECK (
    vendor_service_id IN (
      SELECT vs.vendor_service_id
      FROM public.vendor_services vs
      WHERE vs.vendor_profile_id IN (SELECT public.current_vendor_ids('admin'))
    )
  );

COMMENT ON TABLE public.vendor_service_agents IS
  'Phase 2a — assigns an agent (vendor_team_members) to specific vendor_services. Drives per-service agent scoping: an agent sees only assigned services + the customers tied to them via event_vendors.service_id. Owner/admin manage (RLS via current_vendor_ids(''admin'')); members read.';
