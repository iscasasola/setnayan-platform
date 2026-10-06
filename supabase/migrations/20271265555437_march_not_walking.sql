-- march_not_walking
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

--
-- ⚖ OWNER 2026-10-06 (DECISION_LOG "THE WEDDING MARCH ITEM IS A DRAG-AND-DROP
-- MARCH MAKER"): *"Just show screen for those not added or will not walk the
-- isle."* The Wedding March's phone lower third is the "Not walking" tray —
-- drag a name onto it and that person does not walk; drag them back to add.
--
-- ── WHY A TABLE OF ITS OWN (Rule 0 / Rule 3 — what already exists was checked)
--   · `guests` has no column for it (passed_away and invited_to_blocks mean
--     other things), and a march edit NEVER writes a guest row
--     (`march-edits-touch-no-guest.db.test.ts`).
--   · `march_walks` is one row per person who WALKS — and a guest with NO row is
--     an entourage member nobody has placed yet, who still walks (alone, at the
--     end of their section — the couple themselves have no row until moved).
--     So "no row" already means "walks", and cannot also mean "does not walk".
--   · A flag on `march_walks` would put a non-walker into the walk numbering
--     that every march function counts on (two rows sharing a walk_no ARE one
--     walk) — a pair would silently form with somebody who is not there.
-- ⇒ the smallest honest shape: (event_id, guest_id) — a person here does not
--   walk. Mutually exclusive with `march_walks`, kept so by the ONE writer below.
--
-- 🔑 WHAT PRINTS IS UNCHANGED. A person here has no `march_walks` row, so every
-- print (the invitation, The Entourage card, the "everyone" page) still lists
-- them under their role — alone, after the walks. Only the walking order (the
-- Maker's march and the march actions' fresh read) leaves them out.

CREATE TABLE IF NOT EXISTS public.march_not_walking (
  event_id    UUID        NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  guest_id    UUID        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, guest_id),
  -- A guest OF THIS EVENT (the composite key `march_walks` already made referenceable).
  CONSTRAINT march_not_walking_guest_fkey
    FOREIGN KEY (event_id, guest_id)
    REFERENCES public.guests (event_id, guest_id) ON DELETE CASCADE
);

-- RLS AT CREATE TABLE.
ALTER TABLE public.march_not_walking ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.march_not_walking IS
  'The Wedding March''s "Not walking" tray (owner 2026-10-06): a person with an entourage role who does '
  'not walk the aisle. Never also in march_walks (set_march_walking keeps them exclusive). What prints is '
  'unchanged — they still print under their role; only the walking order leaves them out.';

-- Who may read and write it — exactly the hosts who arrange the march (`march_walks`' own terms).
REVOKE ALL ON public.march_not_walking FROM PUBLIC;
REVOKE ALL ON public.march_not_walking FROM anon;
REVOKE ALL ON public.march_not_walking FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.march_not_walking TO authenticated;
GRANT ALL ON public.march_not_walking TO service_role;

DROP POLICY IF EXISTS march_not_walking_host_all ON public.march_not_walking;
CREATE POLICY march_not_walking_host_all ON public.march_not_walking
  FOR ALL TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
    OR public.moderator_area_level(event_id, 'guest_list') = 'edit'
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
    OR public.moderator_area_level(event_id, 'guest_list') = 'edit'
  );

DROP POLICY IF EXISTS march_not_walking_moderator_read ON public.march_not_walking;
CREATE POLICY march_not_walking_moderator_read ON public.march_not_walking
  FOR SELECT TO authenticated
  USING (public.moderator_area_level(event_id, 'guest_list') IS NOT NULL);

-- ── the ONE writer ────────────────────────────────────────────────────────
-- walks = false → out of the march (their walk row goes; whoever walked with
--                 them keeps the walk and its place, now alone) and into the tray;
-- walks = true  → out of the tray: they walk again, unplaced (alone, at the end
--                 of their section) until a move places them.
-- SECURITY INVOKER (the default): the caller's own RLS decides. Returns 1 when
-- the person now stands where asked, 0 when the caller cannot see them (a
-- zero-row write is success-shaped — the action reads this, never assumes).
CREATE OR REPLACE FUNCTION public.set_march_walking(
  p_event_id UUID,
  p_guest_id UUID,
  p_walks    BOOLEAN
)
RETURNS INT
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.guests
    WHERE event_id = p_event_id AND guest_id = p_guest_id AND deleted_at IS NULL
  ) THEN
    RETURN 0;
  END IF;

  IF p_walks THEN
    DELETE FROM public.march_not_walking
     WHERE event_id = p_event_id AND guest_id = p_guest_id;
    RETURN CASE WHEN EXISTS (
      SELECT 1 FROM public.march_not_walking WHERE event_id = p_event_id AND guest_id = p_guest_id
    ) THEN 0 ELSE 1 END;
  END IF;

  DELETE FROM public.march_walks
   WHERE event_id = p_event_id AND guest_id = p_guest_id;
  INSERT INTO public.march_not_walking (event_id, guest_id)
  VALUES (p_event_id, p_guest_id)
  ON CONFLICT (event_id, guest_id) DO NOTHING;
  RETURN CASE WHEN EXISTS (
    SELECT 1 FROM public.march_not_walking WHERE event_id = p_event_id AND guest_id = p_guest_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.march_walks WHERE event_id = p_event_id AND guest_id = p_guest_id
  ) THEN 1 ELSE 0 END;
END $$;

-- 🔒 REVOKE FROM PUBLIC FIRST — a new function is executable by PUBLIC by default.
REVOKE EXECUTE ON FUNCTION public.set_march_walking(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_march_walking(UUID, UUID, BOOLEAN) TO authenticated;

-- ── the march's other writers keep the two exclusive ──────────────────────
-- A move that PLACES someone (a join, an order write) on a person in the tray
-- would make them walk while the tray still lists them. The march actions
-- refuse it before they write (their fresh read leaves the tray out, so a tray
-- person is not a line they can name); this trigger is the floor under that.
CREATE OR REPLACE FUNCTION public.march_walks_leave_the_tray()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.march_not_walking
   WHERE event_id = NEW.event_id AND guest_id = NEW.guest_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS march_walks_leave_the_tray ON public.march_walks;
CREATE TRIGGER march_walks_leave_the_tray
  AFTER INSERT ON public.march_walks
  FOR EACH ROW EXECUTE FUNCTION public.march_walks_leave_the_tray();

REVOKE ALL ON FUNCTION public.march_walks_leave_the_tray() FROM PUBLIC, anon, authenticated;
