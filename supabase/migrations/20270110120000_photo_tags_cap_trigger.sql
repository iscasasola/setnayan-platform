-- 20270110120000_photo_tags_cap_trigger.sql
--
-- WHY: the "max 10 tags per photo" hard constraint (CLAUDE.md product lock) was
-- enforced ONLY inside the papic_tag_capture RPC (QR tags). Any OTHER writer of
-- public.photo_tags — auto_face (the face auto-tag write path), manual_pick, or
-- any future source — could push a photo past 10. The #1588 review flagged the
-- blanket cap as advisory-in-the-RPC and surfaced the DB-enforcement question
-- for owner sign-off; owner signed off (2026-06-17) to enforce across ALL tag
-- sources. This makes the cap a DB invariant so no writer can break it.
--
-- A "photo" is identified by (source_table, source_id) (papic_photos /
-- papic_guest_captures). The trigger counts existing tags for that photo and,
-- at the cap, RETURNs NULL — which SILENTLY SKIPS the over-cap row (truncate
-- semantics, matching the spec's "alphabetize + truncate" rule for table-QR
-- fan-out) rather than erroring the insert/batch. papic_tag_capture already
-- limits to the remaining cap, so the trigger never fires inside it — it is a
-- pure backstop for the non-RPC paths.
--
-- SECURITY DEFINER + pinned search_path so the count(*) sees ALL of a photo's
-- tags regardless of the caller's RLS view (an RLS-scoped count could undercount
-- and let the cap leak). Idempotent. Additive (no data change).

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_photo_tag_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (
    SELECT count(*) FROM public.photo_tags
    WHERE source_table = NEW.source_table
      AND source_id = NEW.source_id
  ) >= 10 THEN
    RETURN NULL; -- at cap: skip this tag silently (truncate, never error)
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS photo_tags_cap_before_insert ON public.photo_tags;
CREATE TRIGGER photo_tags_cap_before_insert
  BEFORE INSERT ON public.photo_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_photo_tag_cap();

COMMENT ON FUNCTION public.enforce_photo_tag_cap() IS
  'Backstops the 10-tags-per-photo cap (per (source_table, source_id)) across ALL writers of photo_tags — auto_face/manual_pick/etc, not just the papic_tag_capture RPC. At cap, silently skips the over-cap row (truncate). Owner-locked 2026-06-17.';

COMMIT;
