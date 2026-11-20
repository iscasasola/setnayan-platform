-- supplier_today_put_offs
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ⏭ TODAY v3 PART 2 — "DO IT TOMORROW" (owner 19 Nov 2026 on the drawing `Today, tap opens a card` v3.5,
-- artifact F4vQbaCwFtu2iawYd2r6q2: *"drag the card right jump to that part on the page. drag it to the left do it
-- tomorrow"* · *"yes. except urgent"* · *"Yes, all your picks"*; DECISION_LOG 2026-11-19 "TODAY v3 RULED AS A WHOLE").
--
-- The drawing's Flag 2: "Do it tomorrow" had nowhere to be saved — nothing stored a put-off task. This is that
-- record: WHICH SHOP, WHICH TASK, UNTIL WHICH DAY. A row whose `until_day` is after today (Manila) sits under
-- "Tomorrow" instead of "Needs you today"; on `until_day` it is back. Undo deletes the row. The same task may be put
-- off again and again (ruled), so the key is (shop, task) and a second put-off just moves `until_day`.
--
-- 🔴 A red (urgent) row can never go to tomorrow — that rule is decided where the row's deadline is read
-- (`lib/supplier-today-v2.ts`): a red row ignores any record here, so a record can never hide an urgent task.
--
-- `task_key` is the Today row's own key (a desk card's id — `rev-…`, `datechange-…`, `lockreq-…`), never free text.
-- No foreign key to the task itself: a task that leaves the desk (answered, cancelled) simply stops matching, and the
-- record lapses on its own day. Nothing a couple sees reads this table.
--
-- ADD-ONLY: a new table; nothing existing is altered or dropped. RLS on at CREATE TABLE time (pattern: the shop's
-- own rows — `current_vendor_profile_ids()` for the owner, `current_vendor_ids()` for the team).

CREATE TABLE IF NOT EXISTS public.supplier_today_put_offs (
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  task_key          TEXT NOT NULL CHECK (task_key ~ '^[A-Za-z0-9_-]{1,120}$'),
  -- The Manila day the task is back on Today.
  until_day         DATE NOT NULL,
  put_off_by        UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  put_off_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (vendor_profile_id, task_key)
);

ALTER TABLE public.supplier_today_put_offs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.supplier_today_put_offs FROM PUBLIC;
REVOKE ALL ON public.supplier_today_put_offs FROM anon;
REVOKE ALL ON public.supplier_today_put_offs FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_today_put_offs TO authenticated;

DROP POLICY IF EXISTS supplier_today_put_offs_shop_read ON public.supplier_today_put_offs;
CREATE POLICY supplier_today_put_offs_shop_read
  ON public.supplier_today_put_offs FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS supplier_today_put_offs_shop_insert ON public.supplier_today_put_offs;
CREATE POLICY supplier_today_put_offs_shop_insert
  ON public.supplier_today_put_offs FOR INSERT TO authenticated
  WITH CHECK (
    (vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      OR vendor_profile_id IN (SELECT public.current_vendor_ids()))
    AND put_off_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS supplier_today_put_offs_shop_update ON public.supplier_today_put_offs;
CREATE POLICY supplier_today_put_offs_shop_update
  ON public.supplier_today_put_offs FOR UPDATE TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_ids())
  )
  WITH CHECK (
    (vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      OR vendor_profile_id IN (SELECT public.current_vendor_ids()))
    AND put_off_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS supplier_today_put_offs_shop_delete ON public.supplier_today_put_offs;
CREATE POLICY supplier_today_put_offs_shop_delete
  ON public.supplier_today_put_offs FOR DELETE TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_ids())
  );

CREATE INDEX IF NOT EXISTS supplier_today_put_offs_until_idx
  ON public.supplier_today_put_offs (vendor_profile_id, until_day);

COMMENT ON TABLE public.supplier_today_put_offs IS
  'Today v3 part 2 — "Do it tomorrow": a shop put this Today task off until until_day (Manila). Undo deletes the row. A red (urgent) task ignores it. Owner 2026-11-19.';
