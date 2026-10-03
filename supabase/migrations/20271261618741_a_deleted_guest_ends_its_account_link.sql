-- a_deleted_guest_ends_its_account_link
-- Created via `pnpm migration:new`. Idempotent (CREATE OR REPLACE · DROP TRIGGER
-- IF EXISTS · a DELETE that matches nothing on a second run).
--
-- ── THE INCIDENT (live test, prod 5666406, 2026-10-02) ───────────────────────
-- A host removed a guest from the list (soft-delete: `guests.deleted_at` set).
-- The account that had saved that invitation KEPT its `event_members` row
-- (member_type 'guest', guest_id → the removed row). So the account's Home still
-- listed the event with a "You're invited" badge, and tapping it opened a hub
-- that — correctly — said "You're not on the guest list for this event yet".
-- Access was gone; the card was a lie.
--
-- WHY IT HAPPENED: removing a guest is a FLAG, so the FK
-- `event_members_guest_id_fkey` (ON DELETE SET NULL) never fires, and only one
-- of the app's remove paths (claims `removeGuestAction`) deleted the membership
-- by hand. The card delete, the swipe/bulk delete, the +1 seat sync and the
-- claims merge/decline each flip `deleted_at` and leave the link behind.
--
-- ── THE FIX: ONE PLACE EVERY PATH GOES THROUGH ──────────────────────────────
-- A trigger on `guests`, so no remove path — present or future, app or admin,
-- user client or service role — can forget it. It does exactly what the hosts'
-- Unlink (apps/web/lib/seat-unlink.ts step 2) does to the membership: DELETE the
-- one `event_members` row WHERE guest_id = this row AND member_type = 'guest'.
--
--   · ONLY member_type 'guest'. A live Co-host / helper reached through the row
--     (member_type couple / coordinator) is not ended here — the same line
--     Unlink draws (`holds_access`): their Access is removed on its own door.
--     Prod, 2026-10-03: 0 such rows on a removed guest.
--   · SOFT DELETE: fires only on the NULL → set transition. RESTORING the row
--     (set → NULL) does nothing — the link stays ended, so a restore never
--     silently hands the invitation back to the account. The person saves it
--     again themselves ("Save to my account", lib/seat-binding.ts).
--   · HARD DELETE (`ON DELETE` rule): BEFORE DELETE, so the membership is ended
--     while it still names the row. Without it the FK's SET NULL would leave a
--     'guest' membership with no seat — the same lying card, with no guest_id
--     left to find it by. The FK itself is unchanged (SET NULL still governs any
--     non-guest membership).
--
-- SECURITY DEFINER: the couple's own session soft-deletes guests (card / bulk),
-- and a guest-list helper may too; neither may delete ANOTHER account's
-- membership under RLS — and a DELETE refused by RLS matches 0 rows silently,
-- which is exactly the disease this fixes. Not callable directly (returns
-- trigger; EXECUTE revoked anyway).
--
-- RLS: unchanged (no table, no policy).

CREATE OR REPLACE FUNCTION public.a_deleted_guest_ends_its_account_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.event_members
   WHERE guest_id = OLD.guest_id
     AND member_type = 'guest';

  -- BEFORE DELETE must hand back OLD, or the guest row is never deleted.
  -- AFTER UPDATE ignores the value; NEW is returned for clarity.
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.a_deleted_guest_ends_its_account_link() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.a_deleted_guest_ends_its_account_link() IS
  'Removing a guest (soft: deleted_at NULL -> set; hard: DELETE) ends the account link to that row: deletes the event_members row with this guest_id and member_type guest — the same row the hosts'' Unlink (lib/seat-unlink.ts) deletes. Restore does not re-link.';

DROP TRIGGER IF EXISTS a_removed_guest_ends_its_account_link ON public.guests;
CREATE TRIGGER a_removed_guest_ends_its_account_link
AFTER UPDATE OF deleted_at ON public.guests
FOR EACH ROW
WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION public.a_deleted_guest_ends_its_account_link();

DROP TRIGGER IF EXISTS a_deleted_guest_ends_its_account_link ON public.guests;
CREATE TRIGGER a_deleted_guest_ends_its_account_link
BEFORE DELETE ON public.guests
FOR EACH ROW
EXECUTE FUNCTION public.a_deleted_guest_ends_its_account_link();

-- ── DATA REPAIR — end every link that already points at a removed guest ─────
-- Measured read-only on prod 2026-10-03 (Supabase MCP execute_sql, SELECT only):
--   event_members ⋈ guests WHERE guests.deleted_at IS NOT NULL
--     member_type 'guest'                → 1 row (the cale-ice link from the
--                                          2026-10-02 live test)
--     member_type couple / coordinator   → 0 rows (and not touched here)
-- tests/db/a-deleted-guest-ends-its-account-link.db.test.ts re-runs the block
-- between the markers on a fixture and asserts it removes EXACTLY those rows.
-- REPAIR:BEGIN
DELETE FROM public.event_members em
 USING public.guests g
 WHERE em.guest_id = g.guest_id
   AND em.member_type = 'guest'
   AND g.deleted_at IS NOT NULL;
-- REPAIR:END
