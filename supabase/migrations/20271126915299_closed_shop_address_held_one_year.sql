-- ─────────────────────────────────────────────────────────────────────────────
-- A closed shop keeps its address for a year, and erasure can finally finish.
--
-- Two owner decisions, 2026-08-10, taken together because both land on the same
-- moment: the point where a person leaves and their shop stops trading.
--
--   1. *"their old shop's name will never be deleted (unless manual delete by
--      admin). so the slug will be kept for the closed shop. slug will be
--      available again after 1 year from date of deletion."*
--   2. *"Yes, allow wipe."* — erasure may remove the last admin of a shop.
--
-- ── WHY (2) IS A REAL DEFECT AND NOT A TIDY-UP ───────────────────────────────
-- Erasure enumerates a delete of the person's seat in their own shop, described
-- in our own code as *"a credential that must not outlive the account."* That
-- delete cascades into `vendor_team_guard()`, which refuses to remove the last
-- admin — and every shop in production has exactly one, the person who opened
-- it. The refusal comes back as a RETURNED ERROR, not an exception, so
-- `purge.ts`'s `step()` writes an audit line and carries straight on. Erasure
-- then completes and records `user_erased`.
--
-- 🔑 SO WE WERE TELLING A PERSON, AND OUR OWN AUDIT TRAIL, THAT THEY HAD BEEN
-- ERASED WHILE THEIR ACCOUNT REMAINED AN ADMIN OF A LIVE SHOP. Measured against
-- production, not reasoned: the DELETE was refused, and only went through after
-- suspending the trigger for one transaction.
--
-- The guard itself is CORRECT — a shop with no admin is unreachable by its own
-- team. It simply had no exemption for the one case where leaving nobody behind
-- is the whole point.
--
-- 🔑 A RULE WITH NO EXCEPTION IS NOT SAFER THAN ONE WITH A NAMED EXCEPTION. It
-- is the same rule with the exception hidden in whatever the caller does
-- instead — here, swallowing the failure and reporting success.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1 · A CLOSED SHOP'S ADDRESS IS HELD, NOT FREED ───────────────────────────
-- `slug_change_log` already does exactly this job: it holds a word until
-- `redirect_until` passes, and `findSlugConflict` already refuses anything it
-- covers. So a held address needs no new table, no sweep and no scheduled job —
-- the expiry is a timestamp comparison, and the word releases itself.
--
-- It gets its OWN entity_type rather than reusing 'vendor'. A rename and a
-- closure mean different things to every future reader: a rename forwards
-- visitors to where the shop went, a closure forwards nobody anywhere and is
-- only holding the word so it cannot be taken by someone else. Encoding a
-- closure as a rename-to-itself would have worked and would have lied.
ALTER TABLE public.slug_change_log
  DROP CONSTRAINT IF EXISTS slug_change_log_entity_type_check;

ALTER TABLE public.slug_change_log
  ADD CONSTRAINT slug_change_log_entity_type_check
  CHECK (entity_type = ANY (ARRAY['event'::text, 'vendor'::text, 'user'::text, 'vendor_closed'::text]));

COMMENT ON COLUMN public.slug_change_log.entity_type IS
  'event | vendor | user = a RENAME, forwarding visitors to where the thing went. '
  'vendor_closed = a CLOSED shop''s address, held so nobody else can take it; it '
  'forwards nobody anywhere and releases itself when redirect_until passes '
  '(one year from closing, owner-locked 2026-08-10).';

-- ── 2 · THE LAST-ADMIN GUARD LEARNS ONE NAMED EXEMPTION ──────────────────────
CREATE OR REPLACE FUNCTION public.vendor_team_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor        UUID := auth.uid();
  v_approved     BOOLEAN := COALESCE(current_setting('app.vendor_admin_change_approved', true), '') = 'true';
  -- Set ONLY by public.erase_vendor_seats below, which is the RA 10173 erasure
  -- path. Deliberately a separate flag from v_approved: that one means "the
  -- team voted to remove another admin" and must NOT also mean "it is fine to
  -- leave this shop with no admin at all". One flag doing both jobs would let a
  -- team vote empty a shop by accident.
  v_erasing      BOOLEAN := COALESCE(current_setting('app.vendor_seat_erasure', true), '') = 'true';
  v_other_admins INT;
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'admin' THEN
    SELECT count(*) INTO v_other_admins FROM public.vendor_team_members
      WHERE vendor_profile_id = OLD.vendor_profile_id AND role = 'admin'
        AND vendor_team_member_id <> OLD.vendor_team_member_id;
    IF v_other_admins < 1 AND NOT v_erasing THEN
      RAISE EXCEPTION 'VENDOR_LAST_ADMIN: a store must keep at least one admin';
    END IF;
    -- Removing ANOTHER admin needs the approved flag; self-removal is allowed.
    -- Erasure is self-removal by definition (the seat belongs to the subject),
    -- so this arm is left exactly as it was.
    IF v_actor IS NOT NULL AND OLD.user_id <> v_actor AND NOT v_approved THEN
      RAISE EXCEPTION 'VENDOR_ADMIN_CHANGE_NEEDS_VOTE: removing another admin needs a team vote';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role <> 'admin' THEN
    SELECT count(*) INTO v_other_admins FROM public.vendor_team_members
      WHERE vendor_profile_id = OLD.vendor_profile_id AND role = 'admin'
        AND vendor_team_member_id <> OLD.vendor_team_member_id;
    -- NOT exempted. Erasure DELETES a seat; it never demotes one. A demotion
    -- that empties a shop is still the mistake this guard was written to stop.
    IF v_other_admins < 1 THEN
      RAISE EXCEPTION 'VENDOR_LAST_ADMIN: a store must keep at least one admin';
    END IF;
    IF v_actor IS NOT NULL AND OLD.user_id <> v_actor AND NOT v_approved THEN
      RAISE EXCEPTION 'VENDOR_ADMIN_CHANGE_NEEDS_VOTE: demoting another admin needs a team vote';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

-- ── 3 · THE ONLY DOOR THROUGH THE EXEMPTION ──────────────────────────────────
-- The flag is set here and nowhere else, so "who may empty a shop" has exactly
-- one answer that can be read in one place. A caller cannot set it themselves:
-- PostgREST gives no way to issue `SET LOCAL` alongside a `.delete()`, which is
-- precisely why the exemption is a function rather than a session setting the
-- application is trusted to manage.
CREATE OR REPLACE FUNCTION public.erase_vendor_seats(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_removed INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'erase_vendor_seats: p_user_id is required';
  END IF;

  -- `true` = LOCAL: it dies with this transaction. A session-level set would
  -- outlive the erasure and leave the exemption standing for whatever ran next
  -- on the same connection — and connections are pooled.
  PERFORM set_config('app.vendor_seat_erasure', 'true', true);

  DELETE FROM public.vendor_team_members WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  -- Cleared explicitly as well as locally, so the window is the delete and not
  -- the rest of the transaction.
  PERFORM set_config('app.vendor_seat_erasure', '', true);
  RETURN v_removed;
END;
$function$;

REVOKE ALL ON FUNCTION public.erase_vendor_seats(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.erase_vendor_seats(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.erase_vendor_seats(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.erase_vendor_seats(UUID) TO service_role;

COMMENT ON FUNCTION public.erase_vendor_seats(UUID) IS
  'RA 10173 erasure: removes every vendor team seat held by a person, INCLUDING '
  'a seat that is the last admin of a shop (owner ruling 2026-08-10, "Yes, allow '
  'wipe"). service_role only — this is the one door through the last-admin rule, '
  'and it exists because the guard has no exemption a pooled PostgREST '
  'connection could safely set for itself.';
