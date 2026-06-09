-- Plan Builder "Build pick" — the couple's chosen vendor PER CATEGORY in their
-- working build (0016 prototype's Shortlist "Add to build" + Build-tab "Pin").
--
-- Distinct from the two existing per-vendor states on event_vendors:
--   • shortlisted  = event_vendors.status = 'considering' (the bench)
--   • locked       = event_vendors.status IN (contracted/deposit_paid/…) (finalized)
-- A "build pick" is the reversible, money-free, conflict-free middle step: the one
-- vendor the couple has slotted into their build for a category. The PK (event_id,
-- plan_group_id) ENFORCES one pick per category at the DB level (the prototype's
-- single-pin model). Couple-WRITE-ONLY; vendors never see or touch this — so it
-- sits outside the booking conflict surface entirely (Conflict_architecture note).
--
-- vendor_id FKs event_vendors ON DELETE CASCADE: removing a shortlisted vendor
-- (deleteVendor) auto-clears its build pick — no dangling pointer. Additive;
-- read/written only behind BUDGET_BUILD_ENABLED. RA 10173: ON DELETE CASCADE from events.

CREATE TABLE IF NOT EXISTS public.event_build_picks (
  event_id       UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The plan-group / canonical-service key (same key as budget_category_flags +
  -- the accordion leaves) this pick belongs to.
  plan_group_id  TEXT NOT NULL,
  -- The chosen event_vendors row. CASCADE so un-shortlisting clears the pick.
  vendor_id      UUID NOT NULL REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  picked_by      UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, plan_group_id)
);

CREATE INDEX IF NOT EXISTS event_build_picks_event_id_idx ON public.event_build_picks(event_id);
CREATE INDEX IF NOT EXISTS event_build_picks_vendor_id_idx ON public.event_build_picks(vendor_id);

COMMENT ON TABLE public.event_build_picks IS
  'Per-category "build pick" — the couple''s chosen vendor for a category in their working Plan Builder build (Shortlist "Add to build" / Build "Pin"). One pick per (event, plan_group). Reversible, couple-own under RLS, distinct from considering/locked event_vendors states. Consumed only behind BUDGET_BUILD_ENABLED.';

ALTER TABLE public.event_build_picks ENABLE ROW LEVEL SECURITY;

-- Couple reads their own event's build picks.
DROP POLICY IF EXISTS couple_reads_event_build_picks ON public.event_build_picks;
CREATE POLICY couple_reads_event_build_picks ON public.event_build_picks
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
  );

-- Couple inserts a build pick for their own event; stamped with their uid.
DROP POLICY IF EXISTS couple_inserts_event_build_picks ON public.event_build_picks;
CREATE POLICY couple_inserts_event_build_picks ON public.event_build_picks
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    AND picked_by = auth.uid()
  );

-- Couple swaps the pinned vendor for a category (upsert → UPDATE on conflict).
DROP POLICY IF EXISTS couple_updates_event_build_picks ON public.event_build_picks;
CREATE POLICY couple_updates_event_build_picks ON public.event_build_picks
  FOR UPDATE TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
  );

-- Couple removes a build pick (take it back off the build).
DROP POLICY IF EXISTS couple_deletes_event_build_picks ON public.event_build_picks;
CREATE POLICY couple_deletes_event_build_picks ON public.event_build_picks
  FOR DELETE TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
  );
