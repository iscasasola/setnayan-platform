-- ============================================================================
-- 20270711955398_enable_realtime_seating_plan.sql
-- Enable Supabase Realtime for the couple's seat plan (iterations 0008 / lab).
--
-- The seat plan has TWO editors on the same data: the 2D editor
-- (`seating-editor.tsx`) and the 3D lab (`seating-lab-3d.tsx`). A single-editor
-- lock keeps only one PERSON editing, but a co-owner / coordinator viewing the
-- plan (or the couple in the other surface) previously saw the editor's changes
-- only after a manual reload. Opting the three plan tables into the
-- `supabase_realtime` publication lets a VIEW-ONLY surface refresh live the
-- moment a table is moved / rotated / linked / added / removed or a guest is
-- (un)seated. Supabase creates the publication for every project; we opt the
-- right tables in. Mirrors 20270314132689_enable_realtime_budget.sql.
--
-- RLS is already enabled on all three tables and Realtime honors RLS — a
-- viewer only receives change events for rows on an event they can see. No
-- extra policy work is needed.
--
-- REPLICA IDENTITY FULL on event_tables + event_seat_assignments so a DELETE
-- (a removed table / unseated guest) carries the event_id the client filters
-- on — otherwise the default (primary-key-only) old row omits event_id and the
-- `event_id=eq.X` filter would drop delete events. These tables are small and
-- low-frequency, so the extra WAL is negligible.
--
-- Idempotent: each ALTER PUBLICATION is guarded by a pg_publication_tables
-- check; REPLICA IDENTITY FULL is naturally idempotent.
-- ============================================================================

BEGIN;

-- event_tables — position / rotation / link_group / type / label / removed
-- seats. The core of "the other surface follows my layout live".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_tables'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_tables;
  END IF;
END $$;

-- event_seat_assignments — who sits where. Seating / unseating / swapping a
-- guest reflects live in the viewing surface.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_seat_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_seat_assignments;
  END IF;
END $$;

-- event_floor_plan — venue dims, stage, entrance, dance floor. Editing the room
-- itself reshapes the plan for the viewer.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_floor_plan'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_floor_plan;
  END IF;
END $$;

-- Full old-row on UPDATE/DELETE so the event_id filter catches deletes.
ALTER TABLE public.event_tables REPLICA IDENTITY FULL;
ALTER TABLE public.event_seat_assignments REPLICA IDENTITY FULL;

COMMIT;
