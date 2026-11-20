-- event_today_put_offs
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ⏭ EVENT TODAY, FOCUS SHAPE (owner 20 Nov 2026: *"make the Today of the event dashboard run like the Focus of Admin
-- and Today of Suppliers Dashboard"* · *"Yes, build it"*; drawing `prototypes/event_today_focus_2026-11-20/`, v3).
-- "Do it tomorrow" on the event's Today, FOR THE PERSON WHO PUSHED IT ONLY — owner, verbatim: *"tasks would show
-- whoever is on. they have independent tasks. one host may choose to do it tomorrow but the other host hasn't so
-- there is a change that can be done today"*.
--
-- So a put-off is a record of ONE PERSON'S day on ONE EVENT, never of the task: WHICH EVENT, WHO, WHICH ROW, UNTIL
-- WHICH DAY. Nothing about the task changes, and every other host still sees it on Today. A red row (Overdue · Today)
-- ignores any record (`lib/today-put-off.ts`) — an urgent task is never hidden.
--
-- `task_key` is the Today row's own key (`pay:<line item>` · `task:<id>` · `ask:<what>`), never free text.
-- ADD-ONLY: a new table. RLS on at CREATE TABLE time: a person reads and writes only their OWN rows, on events they
-- belong to (`current_event_ids()`).

CREATE TABLE IF NOT EXISTS public.event_today_put_offs (
  event_id   UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_key   TEXT NOT NULL CHECK (task_key ~ '^[A-Za-z0-9_:.-]{1,160}$'),
  -- The Manila day the row is back on this person's Today.
  until_day  DATE NOT NULL,
  put_off_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id, task_key)
);

ALTER TABLE public.event_today_put_offs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.event_today_put_offs FROM PUBLIC;
REVOKE ALL ON public.event_today_put_offs FROM anon;
REVOKE ALL ON public.event_today_put_offs FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_today_put_offs TO authenticated;

DROP POLICY IF EXISTS event_today_put_offs_own ON public.event_today_put_offs;
CREATE POLICY event_today_put_offs_own
  ON public.event_today_put_offs FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND event_id IN (SELECT public.current_event_ids()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND event_id IN (SELECT public.current_event_ids()));

-- The account-deletion cascade walks user_id; the PK leads with event_id.
CREATE INDEX IF NOT EXISTS event_today_put_offs_user_idx ON public.event_today_put_offs (user_id);

COMMENT ON TABLE public.event_today_put_offs IS
  'Event Today, Focus shape — "Do it tomorrow" for THAT person only: on this event, this person put this Today row off until until_day (Manila). Undo deletes the row. A red (Overdue / Today) row ignores it; every other host still sees the task. Owner 2026-11-20.';
