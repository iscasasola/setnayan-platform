-- Pre-drop warning dedup marker (owner 2026-07-11)
-- The full-res-drop-warning cron emails a couple ~2 weeks before their oldest
-- Papic photo ages into the 90-day drop window ("your free full-res window ends
-- in N days — download / connect Drive / Keep Full-Res"). This column dedups it
-- to ONE email per event. Additive + idempotent.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS full_res_drop_warned_at TIMESTAMPTZ;

COMMENT ON COLUMN public.events.full_res_drop_warned_at IS
  'When the couple was emailed the pre-drop warning (3-month full-res drop). NULL = not yet warned. One warning per event.';
