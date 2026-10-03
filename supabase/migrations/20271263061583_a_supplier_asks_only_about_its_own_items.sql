-- a_supplier_asks_only_about_its_own_items
-- Created via `pnpm migration:new`. Idempotent: DROP … IF EXISTS / CREATE OR
-- REPLACE / a DO block that drops CHECKs by what they say, not by a guessed name.
--
-- ── WHY (owner 2026-10-03, DECISION_LOG "SUPPLIERS WRITE THEIR OWN PART OF THE
--    SCHEDULE · COORDINATOR WRITES ALL") ─────────────────────────────────────
-- A booked supplier may ask to ADD, EDIT or DELETE the schedule items that are
-- ITS OWN; on anybody else's item it may only SUGGEST. Every ask is still a
-- request the couple (or the coordinator, The Day = Edit) approves or declines
-- — `event_schedule_suggestions` + the shipped Accept/Decline, widened.
--
-- Measured before this file (C3 report, SUPPLIER_SIDE_REPORT_2026-10-03.md):
--   · `kind` was 'adjust' | 'new' — there was no way to ask for a delete;
--   · the INSERT policy let a supplier propose new times, a new label or a new
--     place for ANY block on the event — the couple's own ceremony included.
--
-- ── WHAT "OWN" MEANS — the column that already says it ─────────────────────
-- `event_schedule_blocks.responsible_vendor_ids` (20270825042743) holds the
-- `event_vendors.vendor_id` booking rows a block is tagged to. It already drives
-- the supplier's "Your slot" / "My slots only" lens. A block is a supplier's own
-- when it is tagged to one of that supplier's bookings on the event. The
-- couple's Accept on a supplier's 'new' request now writes that tag (the app
-- side, schedule/actions.ts), so what a supplier adds becomes theirs.
--
-- ── THE RULE, IN THE DATABASE (a server action is a public HTTP endpoint) ──
--   · 'new'    → no block; always allowed (it becomes the supplier's own).
--   · 'adjust' → on ANY block, as a note-only suggestion (no proposed fields);
--                carrying proposed label / time / place → own blocks only.
--   · 'remove' → own blocks only.
--   and the block must be on the same event as the request.
--
-- ── block_id: ON DELETE CASCADE → ON DELETE SET NULL ───────────────────────
-- Accepting a 'remove' deletes the block. Under CASCADE that delete also
-- deleted the request itself, so the supplier's "Your requests" list would lose
-- the very row that just said yes — a success that renders as an absence. The
-- request now outlives its block (the label is snapshotted in proposed_label).
-- 🔑 SET NULL onto a CHECKed column blocks the parent DELETE if the CHECK
-- demands a block, so the table CHECK below only says what is always true —
-- a 'new' never names a block. "adjust/remove name a block" is a rule about the
-- moment of asking, so it lives in the INSERT policy, where a later delete of
-- the block cannot violate it.
--
-- Proven by apps/web/tests/db/a-supplier-asks-only-about-its-own-items.db.test.ts.

-- ── 1 · the vocabulary ─────────────────────────────────────────────────────
-- Drop every CHECK on the table that mentions `kind` (the inline
-- `kind IN ('adjust','new')` and the table-level `(kind='adjust') =
-- (block_id IS NOT NULL)`, both from 20261130003000 — the only file that ever
-- defined them), whatever Postgres named them.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
     WHERE con.conrelid = 'public.event_schedule_suggestions'::regclass
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) ILIKE '%kind%'
  LOOP
    EXECUTE format('ALTER TABLE public.event_schedule_suggestions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- The FULL vocabulary: the two from 20261130003000 plus 'remove'.
ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_kind_check
  CHECK (kind IN ('adjust', 'new', 'remove'));

ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_new_names_no_block
  CHECK (kind <> 'new' OR block_id IS NULL);

-- ── 2 · the request outlives the block it was about ────────────────────────
ALTER TABLE public.event_schedule_suggestions
  DROP CONSTRAINT IF EXISTS event_schedule_suggestions_block_id_fkey;
ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_block_id_fkey
  FOREIGN KEY (block_id) REFERENCES public.event_schedule_blocks(block_id) ON DELETE SET NULL;

-- ── 3 · "is this block mine?" ──────────────────────────────────────────────
-- SECURITY DEFINER because a supplier has no read on `event_vendors` (the
-- couple's records). It answers ONLY for a vendor profile the caller owns, so it
-- is not an oracle about anybody else's tags.
CREATE OR REPLACE FUNCTION public.current_vendor_owns_schedule_block(
  p_block_id uuid,
  p_vendor_profile_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
     AND EXISTS (
       SELECT 1
         FROM public.event_schedule_blocks b
         JOIN public.event_vendors ev
           ON ev.event_id = b.event_id
          AND ev.vendor_id = ANY (b.responsible_vendor_ids)
        WHERE b.block_id = p_block_id
          AND ev.marketplace_vendor_id = p_vendor_profile_id
     );
$$;

REVOKE ALL ON FUNCTION public.current_vendor_owns_schedule_block(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_vendor_owns_schedule_block(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.current_vendor_owns_schedule_block(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.current_vendor_owns_schedule_block(uuid, uuid) IS
  'True when the block is tagged (responsible_vendor_ids) to a booking of this '
  'vendor profile on the block''s event AND the caller owns that profile. The '
  '"own items" test behind schedule_suggestions_vendor_insert (owner 2026-10-03).';

-- ── 4 · the INSERT policy ──────────────────────────────────────────────────
-- Copied from its only definition (20261130003000) — booked on the event, own
-- org, own user, status open — with the own-items rule appended.
DROP POLICY IF EXISTS schedule_suggestions_vendor_insert ON public.event_schedule_suggestions;
CREATE POLICY schedule_suggestions_vendor_insert
  ON public.event_schedule_suggestions FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND suggested_by_user_id = auth.uid()
    AND status = 'open'
    -- an add names no block; a change or a removal names exactly one…
    AND (kind = 'new') = (block_id IS NULL)
    -- …on this event
    AND (
      block_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.event_schedule_blocks b
         WHERE b.block_id = event_schedule_suggestions.block_id
           AND b.event_id = event_schedule_suggestions.event_id
      )
    )
    AND (
      kind = 'new'
      -- a suggestion (words only) may go on anybody's item
      OR (
        kind = 'adjust'
        AND proposed_label IS NULL
        AND proposed_start_at IS NULL
        AND proposed_end_at IS NULL
        AND proposed_location IS NULL
      )
      -- an edit or a delete only on the supplier's own
      OR public.current_vendor_owns_schedule_block(block_id, vendor_profile_id)
    )
  );

COMMENT ON TABLE public.event_schedule_suggestions IS
  'Supplier requests on the day''s schedule. A booked supplier asks to add (new), '
  'edit (adjust with proposed fields) or delete (remove) ITS OWN items and may '
  'only suggest (adjust, note only) on anybody else''s; the couple or a delegate '
  'holding schedule edit approves or declines. Suppliers never write '
  'event_schedule_blocks directly.';
