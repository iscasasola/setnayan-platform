-- Iteration 0001 · Guest Groups + Memberships
-- ----------------------------------------------------------------------
-- Owner directive 2026-05-22: hosts loading 100+ guests via CSV need
-- a way to organize them BEYOND the locked guests.role enum. Custom
-- groups (e.g., "College Friends", "Coworkers from Acme", "Mom's side
-- family reunion crowd") are many-to-many with guests + carry a
-- team_side flag (Team Bride / Team Groom / Both) so the host can see
-- at a glance which side of the wedding the group belongs to.
--
-- Coexists with the existing role-group sidebar views in
-- apps/web/lib/role-groups.ts — those stay locked per iteration 0001
-- spec. This migration introduces ADDITIONAL groupings on top.
--
-- Idempotent via IF NOT EXISTS — safe to re-run.
-- ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.guest_groups (
  group_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id  TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('G'),
  event_id   UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  label      TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 64),
  team_side  TEXT NOT NULL DEFAULT 'both'
             CHECK (team_side IN ('bride', 'groom', 'both')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive label uniqueness per event so "Coworkers" + "coworkers"
-- can't both exist on the same wedding.
CREATE UNIQUE INDEX IF NOT EXISTS guest_groups_event_label_idx
  ON public.guest_groups (event_id, lower(label));

CREATE INDEX IF NOT EXISTS guest_groups_event_idx
  ON public.guest_groups (event_id);

CREATE TABLE IF NOT EXISTS public.guest_group_memberships (
  group_id UUID NOT NULL REFERENCES public.guest_groups(group_id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, guest_id)
);

CREATE INDEX IF NOT EXISTS guest_group_memberships_guest_idx
  ON public.guest_group_memberships (guest_id);

CREATE INDEX IF NOT EXISTS guest_group_memberships_group_idx
  ON public.guest_group_memberships (group_id);

-- updated_at trigger for guest_groups.
CREATE OR REPLACE FUNCTION public.tg_guest_groups_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guest_groups_set_updated_at ON public.guest_groups;
CREATE TRIGGER guest_groups_set_updated_at
  BEFORE UPDATE ON public.guest_groups
  FOR EACH ROW EXECUTE FUNCTION public.tg_guest_groups_set_updated_at();

-- ----------------------------------------------------------------------
-- RLS · mirrors the guests-table pattern from
-- 20260513010000_iteration_0001_guests.sql: event_members may READ;
-- couples (member_type = 'couple') AND admins may write.
-- ----------------------------------------------------------------------

ALTER TABLE public.guest_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_group_memberships ENABLE ROW LEVEL SECURITY;

-- guest_groups read · any event member can list the groups for events
-- they belong to (matches the sidebar render).
DROP POLICY IF EXISTS event_member_can_read_guest_group ON public.guest_groups;
CREATE POLICY event_member_can_read_guest_group ON public.guest_groups
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

-- guest_groups write · couples + admins only (same gate as guests).
DROP POLICY IF EXISTS couple_writes_guest_group ON public.guest_groups;
CREATE POLICY couple_writes_guest_group ON public.guest_groups
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

-- guest_group_memberships read · any event member can read memberships
-- for groups in their events (we join through guest_groups to get the
-- event_id since memberships don't carry it directly).
DROP POLICY IF EXISTS event_member_can_read_membership ON public.guest_group_memberships;
CREATE POLICY event_member_can_read_membership ON public.guest_group_memberships
  FOR SELECT TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM public.guest_groups
      WHERE event_id IN (SELECT public.current_event_ids())
    )
  );

-- guest_group_memberships write · couples + admins only.
DROP POLICY IF EXISTS couple_writes_membership ON public.guest_group_memberships;
CREATE POLICY couple_writes_membership ON public.guest_group_memberships
  FOR ALL TO authenticated
  USING (
    group_id IN (
      SELECT g.group_id FROM public.guest_groups g
      WHERE g.event_id IN (
        SELECT event_id FROM public.event_members
        WHERE user_id = auth.uid() AND member_type = 'couple'
      )
    )
    OR public.is_admin()
  )
  WITH CHECK (
    group_id IN (
      SELECT g.group_id FROM public.guest_groups g
      WHERE g.event_id IN (
        SELECT event_id FROM public.event_members
        WHERE user_id = auth.uid() AND member_type = 'couple'
      )
    )
    OR public.is_admin()
  );
