-- Couple planning checklist · event_checklist_items
-- ----------------------------------------------------------------------
-- Owner directive 2026-06-13: a lightweight, zero-cost planning checklist
-- for the couple dashboard. A standard PH-wedding task template seeds on
-- first open; a pure ranking filter (lib/checklist.ts) surfaces only the
-- top-N most time-urgent OPEN items for wherever the couple is in the
-- runway.
--
-- LINEAGE NOTE — this is NOT the retired "Today's Focus" wizard. That
-- single-thing wizard was owner-retired 2026-06-03 (/today redirects;
-- lib/wizard.ts + lib/todays-one-thing.ts dormant). This is a different
-- surface: a multi-item, check-off-at-your-own-pace list. Owner re-opted
-- into a checklist system 2026-06-13 (see DECISION_LOG.md).
--
-- RLS mirrors the guest_groups pattern
-- (20260604170000_iteration_0001_guest_groups.sql): event members READ;
-- couples + admins WRITE. RLS enabled at CREATE TABLE time per the
-- canonical 8-pattern contract.
--
-- Idempotent via IF NOT EXISTS — safe to re-run.
-- ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_checklist_items (
  item_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id       TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('J'),
  event_id        UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- Template key when seeded from CHECKLIST_TEMPLATE; NULL for a host-added
  -- custom item. Unique per event so the seed can't double-insert a key.
  template_key    TEXT,
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  category        TEXT NOT NULL DEFAULT 'foundations'
                  CHECK (category IN (
                    'foundations', 'vendors', 'guests', 'paperwork',
                    'attire', 'design', 'logistics', 'final_week'
                  )),
  -- Days BEFORE the event this item is due (its planning window). NULL =
  -- no countdown (a manual host item). due_date is computed in app code
  -- (event_date − offset) so it auto-tracks date changes without a backfill.
  due_offset_days INTEGER,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'done')),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One seeded row per template key per event (the seed is idempotent against
-- this). Partial index so multiple NULL-key custom items can coexist.
CREATE UNIQUE INDEX IF NOT EXISTS event_checklist_items_event_template_idx
  ON public.event_checklist_items (event_id, template_key)
  WHERE template_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS event_checklist_items_event_idx
  ON public.event_checklist_items (event_id);

-- Keep completed_at consistent with status without trusting the caller:
-- set it when a row flips to done, clear it when it flips back to pending.
CREATE OR REPLACE FUNCTION public.tg_event_checklist_items_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'done' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  ELSIF NEW.status = 'pending' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_checklist_items_completed_at ON public.event_checklist_items;
CREATE TRIGGER event_checklist_items_completed_at
  BEFORE INSERT OR UPDATE ON public.event_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_event_checklist_items_completed_at();

-- ----------------------------------------------------------------------
-- RLS · event members may READ; couples (member_type = 'couple') + admins
-- may WRITE. Same gate as guest_groups.
-- ----------------------------------------------------------------------

ALTER TABLE public.event_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_member_can_read_checklist ON public.event_checklist_items;
CREATE POLICY event_member_can_read_checklist ON public.event_checklist_items
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

DROP POLICY IF EXISTS couple_writes_checklist ON public.event_checklist_items;
CREATE POLICY couple_writes_checklist ON public.event_checklist_items
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
