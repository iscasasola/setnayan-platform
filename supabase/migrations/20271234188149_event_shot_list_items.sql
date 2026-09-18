-- ═══════════════════════════════════════════════════════════════════════════
-- event_shot_list_items — the shot list finally reaches the couple (DAY-10).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY THIS TABLE EXISTS AT ALL
-- `vendor-dashboard/on-the-day/_components/shot-list.tsx` has been
-- localStorage-only since it shipped, and its own header named this as the
-- follow-up: "a synced, couple-shared shot list is a follow-up (would need a
-- table + booked-vendor RLS)." PR #5502 removed the console heading that
-- CLAIMED the list reaches the couple; this migration is the mechanism that
-- makes the claim true. Same shape as the issues log's follow-up,
-- `event_day_requests` (20271013100000).
--
-- RULE 0 — no existing table expresses this. `event_preparation_items` is a
-- dated agenda (task / meeting / payment), not a checklist of moments;
-- `couple_briefs` is the retired RFP idea; `booking_handovers` is finished
-- deliverables. A shot is a row on ONE supplier's list for ONE event.
--
-- ONE LIST PER (event, supplier). A photographer and a videographer booked on
-- the same wedding each keep their own list; the couple sees both, labelled.
--
-- WHO MAY DO WHAT
--   • the booked supplier (profile owner or team member) — reads and writes
--     their OWN list on an event they are booked on;
--   • the event side (couple / co-host members) — reads every supplier's list
--     on their event. Read-only for now: the couple adding "must-have moments"
--     is a product call, not a side effect of a sync.
--   • anyone else — nothing.
--
-- NO `*_user_id` COLUMN, deliberately: authorship is the supplier
-- (`vendor_profile_id`), which is what the couple is shown. A per-person
-- author would add an erasure + export surface for no reader.
--
-- ⚠ DEFAULT ACL: every new relation in `public` ships OPEN to anon AND
-- authenticated on this project. The REVOKE ALL in § 3 is load-bearing.

-- ── 1 · The table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_shot_list_items (
  item_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id  UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,

  -- 140 matches the shipped ShotList input maxLength exactly, so a shot the
  -- supplier could type yesterday still saves today.
  label              TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 140),

  -- Display order within one supplier's list. Gaps are fine.
  position           INTEGER NOT NULL DEFAULT 0,

  -- NULL = not yet captured. A timestamp rather than a boolean so the couple
  -- can be told WHEN, and so "captured" can never be true without a moment.
  captured_at        TIMESTAMPTZ,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The only read pattern: this event (optionally this supplier), in order.
CREATE INDEX IF NOT EXISTS event_shot_list_items_event_vendor_idx
  ON public.event_shot_list_items (event_id, vendor_profile_id, position);
-- FK covering index for the vendor_profiles cascade.
CREATE INDEX IF NOT EXISTS event_shot_list_items_vendor_idx
  ON public.event_shot_list_items (vendor_profile_id);

ALTER TABLE public.event_shot_list_items ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.event_shot_list_items IS
  'A booked photo/video supplier''s day-of shot list for one event — one row per shot. The supplier writes their own list from the On the Day console; the couple reads every supplier''s list on their vendor workspace. Replaces the device-local list in on-the-day/_components/shot-list.tsx, which is now only an offline cache of these rows.';

COMMENT ON COLUMN public.event_shot_list_items.captured_at IS
  'NULL = not captured yet. Set when the supplier checks the shot off; cleared when they un-check it.';

-- ── 2 · updated_at trigger ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_event_shot_list_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS event_shot_list_items_touch ON public.event_shot_list_items;
CREATE TRIGGER event_shot_list_items_touch
  BEFORE UPDATE ON public.event_shot_list_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_event_shot_list_items();

REVOKE ALL ON FUNCTION public.touch_event_shot_list_items() FROM PUBLIC, anon, authenticated;

-- ── 3 · Privileges — REVOKE FIRST, then grant back the minimum ─────────────

REVOKE ALL ON public.event_shot_list_items FROM PUBLIC;
REVOKE ALL ON public.event_shot_list_items FROM anon;
REVOKE ALL ON public.event_shot_list_items FROM authenticated;

-- DELETE is granted: a shot list is the supplier's working checklist, and
-- removing a shot they will not take is a normal edit, not erasing a record.
-- INSERT and UPDATE are COLUMN lists, not table grants: RLS is row-level and
-- cannot constrain a value, so only the grant keeps ids and timestamps
-- server-owned, and keeps an UPDATE from ever re-pointing a row at another
-- event or supplier (event_id / vendor_profile_id are insert-only).
GRANT SELECT, DELETE ON public.event_shot_list_items TO authenticated;
GRANT INSERT (event_id, vendor_profile_id, label, position, captured_at)
  ON public.event_shot_list_items TO authenticated;
GRANT UPDATE (label, position, captured_at)
  ON public.event_shot_list_items TO authenticated;
GRANT ALL ON public.event_shot_list_items TO service_role;

-- ── 4 · RLS ────────────────────────────────────────────────────────────────
-- Canonical helpers only: current_event_ids() for the event side;
-- current_vendor_booked_event_ids() + current_vendor_profile_ids() /
-- current_vendor_ids() for the supplier (owner OR team member — the same
-- identity resolution current_vendor_booked_event_ids() itself uses).

-- 4a · The event side reads every supplier's list on their event.
DROP POLICY IF EXISTS event_shot_list_items_event_read ON public.event_shot_list_items;
CREATE POLICY event_shot_list_items_event_read
  ON public.event_shot_list_items FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

-- 4b · The booked supplier manages their OWN list, only on an event they are
--      booked on. USING and WITH CHECK are identical, so an UPDATE can neither
--      move a row onto another supplier nor onto an event they are not on.
DROP POLICY IF EXISTS event_shot_list_items_vendor_all ON public.event_shot_list_items;
CREATE POLICY event_shot_list_items_vendor_all
  ON public.event_shot_list_items FOR ALL TO authenticated
  USING (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND (
      vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      OR vendor_profile_id IN (SELECT public.current_vendor_ids())
    )
  )
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND (
      vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      OR vendor_profile_id IN (SELECT public.current_vendor_ids())
    )
  );
