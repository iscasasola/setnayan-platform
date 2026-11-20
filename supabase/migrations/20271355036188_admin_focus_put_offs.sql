-- admin_focus_put_offs
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ⏭ TODAY v3 PART 4 — ADMIN FOCUS, SAME RULES (owner 19 Nov 2026: *"this applies to admin and supplier's today"* ·
-- *"Yes, all your picks"*; drawing `Today, tap opens a card` v3.5, V3 · 4; DECISION_LOG 2026-11-19 "TODAY v3 RULED AS
-- A WHOLE": *Admin "Do it tomorrow" puts it off for that admin only*).
--
-- An admin Focus item is shared by every admin, so putting it off is a record of ONE ADMIN'S day, never of the item:
-- WHO, WHICH ITEM, UNTIL WHICH DAY. Nothing about the queue or the item changes, and every other admin still sees it.
-- A red (overdue) item ignores any record (`lib/today-put-off.ts`) — an urgent item is never hidden.
--
-- `item_key` is the Focus row's own key (`<queue>:<item id>` or `<queue>:queue`), never free text.
-- ADD-ONLY: a new table. RLS on at CREATE TABLE time: an admin reads and writes only their OWN rows.

CREATE TABLE IF NOT EXISTS public.admin_focus_put_offs (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key   TEXT NOT NULL CHECK (item_key ~ '^[A-Za-z0-9_:.-]{1,160}$'),
  -- The Manila day the item is back in this admin's Focus.
  until_day  DATE NOT NULL,
  put_off_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_key)
);

ALTER TABLE public.admin_focus_put_offs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_focus_put_offs FROM PUBLIC;
REVOKE ALL ON public.admin_focus_put_offs FROM anon;
REVOKE ALL ON public.admin_focus_put_offs FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_focus_put_offs TO authenticated;

DROP POLICY IF EXISTS admin_focus_put_offs_own ON public.admin_focus_put_offs;
CREATE POLICY admin_focus_put_offs_own
  ON public.admin_focus_put_offs FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.is_admin()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.is_admin()));

COMMENT ON TABLE public.admin_focus_put_offs IS
  'Today v3 part 4 — admin Focus "Do it tomorrow", for THAT admin only: this admin put this Focus item off until until_day (Manila). Undo deletes the row. An overdue item ignores it. Owner 2026-11-19.';
