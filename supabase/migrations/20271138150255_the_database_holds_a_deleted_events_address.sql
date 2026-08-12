-- ============================================================================
-- THE APP-SIDE HOLD COVERED ONE DELETE PATH. THE DATABASE PERMITS ANOTHER.
--
-- `20271137423166` made a deleted wedding hold its address, written in
-- `deleteEvent` — the ADMIN path. But prod carries a live RLS policy
-- `couple_can_delete_event` (DELETE, `authenticated`,
-- `event_id IN current_couple_event_ids() OR is_admin()`), so a couple can
-- delete their own wedding straight through PostgREST with no server action
-- involved and no hold written. The word would be free the same second — the
-- exact defect the previous migration was written to close, reachable by the
-- one person whose links break.
--
-- 🔑 A PROMISE THE DATABASE DOES NOT KEEP IS NOT A PROMISE. This repo already
-- learned that on the shop-address trigger: removing the button closes the
-- BUTTON, not the DOOR. Same answer here — the hold moves into the database, so
-- no path present or future can miss it, including one nobody has written yet.
--
-- (No couple-facing delete exists in the product today. That is exactly the
-- state the shop-address guard was in when it was written, and the reason to
-- close it now rather than after somebody adds the screen.)
--
-- ── THE ONE DELIBERATE EXEMPTION ────────────────────────────────────────────
-- Abandoned ANONYMOUS drafts. `lib/anon-draft-sweep.ts` clears drafts that were
-- never published, never printed and never shared — holding those words for two
-- years would burn a real couple's natural address to protect a link that never
-- left the browser it was made in. The sweep opts out per-statement with
-- `setnayan.skip_slug_hold`, the same escape-hatch idiom as
-- `setnayan.allow_slug_change`, so the DEFAULT is to hold.
--
-- ⚠ Set at RUNTIME by the caller, never as a function-level `SET` — prod refuses
-- that with 42501 and the PGlite replay, running as superuser, does NOT catch
-- it. See `lint-no-function-level-custom-set.mjs`.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.hold_event_address_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Nothing to hold.
  IF OLD.slug IS NULL OR length(trim(OLD.slug)) = 0 THEN
    RETURN OLD;
  END IF;

  -- The abandoned-draft sweep, opting out for its own statement only.
  IF COALESCE(current_setting('setnayan.skip_slug_hold', true), '') = 'on' THEN
    RETURN OLD;
  END IF;

  -- ON CONFLICT DO NOTHING is deliberate: re-running a delete, or a path that
  -- also writes its own hold, must not raise and abort the deletion. A hold
  -- that already exists is the outcome we wanted.
  INSERT INTO public.slug_change_log
    (entity_type, entity_id, old_slug, new_slug, redirect_until)
  VALUES
    ('event_closed', OLD.event_id, lower(trim(OLD.slug)), lower(trim(OLD.slug)),
     now() + '24 months'::interval)
  ON CONFLICT DO NOTHING;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS events_hold_address_on_delete ON public.events;
CREATE TRIGGER events_hold_address_on_delete
  BEFORE DELETE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.hold_event_address_on_delete();

-- ── The one caller that opts out ───────────────────────────────────────────
-- The abandoned-draft sweep runs over PostgREST with the service client and so
-- cannot wrap its DELETE in a `SET LOCAL`. This gives it one, scoped to the
-- statement, rather than leaving it to hold words nobody was ever given.
--
-- ⚠ RUNTIME set_config, restoring the caller's prior value on every exit path
-- including an exception — NOT a function-level SET, which prod refuses with
-- 42501 while the superuser PGlite replay accepts it.
CREATE OR REPLACE FUNCTION public.sweep_delete_abandoned_events(p_event_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prev    TEXT := coalesce(current_setting('setnayan.skip_slug_hold', true), '');
  v_deleted INTEGER := 0;
BEGIN
  IF p_event_ids IS NULL OR array_length(p_event_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  BEGIN
    PERFORM set_config('setnayan.skip_slug_hold', 'on', true);
    DELETE FROM public.events WHERE event_id = ANY(p_event_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    PERFORM set_config('setnayan.skip_slug_hold', v_prev, true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('setnayan.skip_slug_hold', v_prev, true);
    RAISE;
  END;

  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.sweep_delete_abandoned_events(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sweep_delete_abandoned_events(uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_delete_abandoned_events(uuid[]) TO service_role;

COMMENT ON FUNCTION public.sweep_delete_abandoned_events(uuid[]) IS
  'Deletes abandoned ANONYMOUS drafts WITHOUT holding their addresses — they were '
  'never published, printed or shared, and holding them would burn a real couple''s '
  'natural address. The ONLY intended opt-out from hold_event_address_on_delete. '
  'service_role only.';

COMMENT ON FUNCTION public.hold_event_address_on_delete() IS
  'Holds a deleted wedding''s address for the retirement window so it cannot be '
  'reissued while printed invitations still carry it. In the DATABASE because '
  'RLS policy couple_can_delete_event lets a couple delete their own event with '
  'no server action involved — an app-side hold covers the admin path only. '
  'Escape: SET LOCAL setnayan.skip_slug_hold = ''on'' (abandoned anonymous drafts).';

-- ── The stale claim on the sibling column, from two migrations ago ──────────
-- `20271132344178` wrote "Closed-shop holds set this EXPLICITLY to one year".
-- Owner 2026-08-12 raised every retirement hold to two years, and a comment
-- stating a superseded figure beside the live one is how this corpus gets read
-- from the middle.
COMMENT ON COLUMN public.slug_change_log.redirect_until IS
  'When this retired address stops being held. DEFAULT 24 months (mirrors '
  'SLUG_FORWARDING_MONTHS in lib/slug-forwarding-window.ts). The _closed holds '
  'set it EXPLICITLY, to the SAME span (RETIRED_SLUG_HOLD_MONTHS) since owner '
  '2026-08-12 "make it 2 years" — superseding the one-year lock of 2026-08-10. '
  'Explicit, not inherited, so the hold cannot silently drift with the window.';

COMMIT;
