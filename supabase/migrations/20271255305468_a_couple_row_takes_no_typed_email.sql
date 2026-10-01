-- a_couple_row_takes_no_typed_email
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)


-- ============================================================================
-- A COUPLE ROW TAKES NO TYPED EMAIL (2026-09-30 — follows 20271254506023).
--
-- The hole, same class as the owner's GROOM-row incident: whoever holds a
-- bride / groom / celebrant row's personal key could type their own address
-- into that row (the RSVP reply's email box, or the "keep this invitation"
-- link). `set_guest_person` (BEFORE INSERT OR UPDATE OF email) then resolved
-- the row's person FROM THAT ADDRESS — i.e. pointed it at the typist's own
-- account — and `is_event_celebrant` counts a claimed person on a celebrant
-- row. No binding needed: a typed email alone made a stranger a celebrant.
--
-- The app now refuses those writes at the source (submitRsvp and
-- sendEventAccountMagicLink skip a couple row's email unless the couple sent
-- the link). THIS is the database floor under it, for every writer:
--
--   🔒 On a COUPLE row (role or extra role in bride · groom · celebrant), the
--   email only resolves the row's person when that address belongs to an
--   account that is ALREADY one of this event's `couple` members. Otherwise
--   the trigger leaves person_id exactly as the statement left it.
--
-- How the couple's own paths still work:
--   · the creator's own row carries the creator's address → a couple member →
--     resolved as before (and the Unlink re-send, lib/seat-unlink.ts, restores
--     it the same way);
--   · a PARTNER who is not yet a member gets their row through the couple's
--     own signed sign-in link (lib/seat-link-approval.ts): the binding writes
--     event_members, and `link_guest_to_account_person` links the person on
--     ACCOUNT evidence — never on a typed address.
-- Every non-couple row resolves exactly as before.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_guest_person()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host UUID;
BEGIN
  SELECT em.user_id INTO v_host
  FROM public.event_members em
  WHERE em.event_id = NEW.event_id AND em.member_type = 'couple'
  ORDER BY em.user_id
  LIMIT 1;

  IF nullif(trim(NEW.email), '') IS NOT NULL THEN
    -- 🔒 THE GATE: a couple row's address counts only if it is a couple
    -- member's own. Anything else leaves person_id as the statement set it.
    IF (NEW.role::text IN ('bride', 'groom', 'celebrant')
        OR coalesce(NEW.extra_roles::text[], '{}') && ARRAY['bride', 'groom', 'celebrant'])
       AND NOT EXISTS (
         SELECT 1
         FROM public.event_members em
         JOIN public.users u ON u.user_id = em.user_id
         WHERE em.event_id = NEW.event_id
           AND em.member_type = 'couple'
           AND lower(trim(u.email)) = lower(trim(NEW.email))
       ) THEN
      RETURN NEW;
    END IF;

    NEW.person_id := public.resolve_or_claim_person(
      p_email        => NEW.email,
      p_display_name => NEW.display_name,
      p_first_name   => NEW.first_name,
      p_last_name    => NEW.last_name,
      p_phone        => NEW.mobile,
      p_photo_url    => NEW.profile_photo_url,
      p_creator      => v_host
    );
    RETURN NEW;
  END IF;

  NEW.person_id := public.resolve_cluster_guest_person(
    NEW.event_id, NEW.first_name, NEW.last_name, v_host
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_guest_person() IS
  'Person-spine: resolve a guest row''s person from its email (else the bounded same-cluster name match). 2026-09-30: on a COUPLE row (bride/groom/celebrant, primary or extra role) the email resolves the person only when it belongs to an account that is already a couple member of the event — a typed address never makes its typist a celebrant.';

