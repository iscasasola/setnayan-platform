-- person spine link guest to account person
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ============================================================================
-- Person-spine · Phase 1 · link guests to their person node BY ACCOUNT
-- (owner 2026-07-05: "guest list can have names without links — that is fine.
--  only those who created accounts will be linked").
--
-- The strong, safe linking signal is ACCOUNT ASSOCIATION, not email/name
-- guessing. When a guest JOINS an event with an account, an event_members row
-- exists with member_type='guest' + a user_id + a guest_id. That user already
-- has a claimed person node (self-claim). This wires `guests.person_id` to that
-- person — so a guest who created an account is linked; name-only guests stay
-- unlinked (by design). Additive, adults-only, no counsel gate.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.link_guest_to_account_person()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_person UUID;
BEGIN
  -- Only account-associated guest memberships carry a link.
  IF NEW.member_type = 'guest' AND NEW.user_id IS NOT NULL AND NEW.guest_id IS NOT NULL THEN
    SELECT person_id INTO v_person
    FROM public.people
    WHERE claimed_by_user_id = NEW.user_id AND deleted_at IS NULL
    LIMIT 1;
    IF v_person IS NOT NULL THEN
      UPDATE public.guests
      SET person_id = v_person
      WHERE guest_id = NEW.guest_id
        AND (person_id IS NULL OR person_id IS DISTINCT FROM v_person);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.link_guest_to_account_person() IS
  'Person-spine: when a guest joins with an account (event_members member_type=guest + user_id + guest_id), link that guests row to the account holder''s person node. Account association is the linking signal; name-only guests stay unlinked.';

DROP TRIGGER IF EXISTS link_guest_to_account_person ON public.event_members;
CREATE TRIGGER link_guest_to_account_person
  AFTER INSERT OR UPDATE OF user_id, guest_id, member_type ON public.event_members
  FOR EACH ROW EXECUTE FUNCTION public.link_guest_to_account_person();

-- Backfill any existing account-associated guests (0 today; future-proof + idempotent).
UPDATE public.guests g
SET person_id = p.person_id
FROM public.event_members em
JOIN public.people p ON p.claimed_by_user_id = em.user_id AND p.deleted_at IS NULL
WHERE em.member_type = 'guest'
  AND em.user_id IS NOT NULL
  AND em.guest_id = g.guest_id
  AND g.person_id IS NULL;
