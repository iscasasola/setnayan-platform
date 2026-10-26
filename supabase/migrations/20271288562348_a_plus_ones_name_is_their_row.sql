-- ═══════════════════════════════════════════════════════════════════════════
-- A GUEST'S +1 NAME IS THEIR +1 ROW — the one-name copy follows the rows
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚖ Owner, verbatim, 2026-10-26 (cale-ice, guest Juanita Sacdalan): "I deleted
-- that guest and added a new plus 1. It is still there?"
--
-- 🪤 WHAT WAS WRONG. A guest's +1s are ROWS (`plus_one_of_guest_id`, owner
-- 2026-09-21: "+3" is three rows). The bringer ALSO carries a one-name COPY,
-- `guests.plus_one_name`, written by the reply (`submitRsvp`'s mirror, "so the
-- host's list chips stop reading '+ TBA'"), by the host's add form, by the
-- import. Nothing ever wrote it back when the row it copied went away or was
-- renamed: the host's Delete on a +1, Release seat, a bulk delete, the count
-- trimming seats, an Undo bringing one back — each changed the ROW and left the
-- copy. Measured in prod 2026-10-26 (read-only): Juanita's +1 "Ggvv Vfh" removed
-- at 01:57:38, a fresh "+1 · TBA" seat minted at 01:57:48, and her row still
-- reading plus_one_name = 'Ggvv Vfh' — a person who is on no live row anywhere.
-- Rows that ALREADY disagree are fixed by the separate, named backfill
-- (20271289389441_backfill_stale_plus_one_names.sql).
--
-- ✅ THE FIX. The DATABASE keeps the copy in step, whichever writer touched the
-- row — the card, the List, Release seat, a bulk delete, Undo, the reply, the
-- count trim, an import, SQL:
--   · the copy IS the name of the bringer's oldest live NAMED +1 row (the reply's
--     "first name given"), or NULL when none of their live +1 rows has a name;
--   · it is recomputed whenever a NAMED +1 row appears, goes (soft or hard
--     delete), comes back (Undo), is renamed, or moves to another bringer — i.e.
--     whenever the row the copy could be speaking for changes;
--   · an UNNAMED seat ("TBA" / "+1", `isPlaceholderSeat` + `realNameParts` in
--     lib/extra-seats.ts / lib/seat-placeholder-words.ts) never triggers it, so the
--     count's own minting and trimming of placeholders leaves the copy alone.
-- A +1 brings no +1 (`a_plus_one_brings_no_one`), so recomputing a bringer never
-- fires this again: the bringer's own row is not a +1 row.
--
-- 🔑 Deliberately NO advisory lock: the reply's mint already holds
-- 'guest_plus_one_seat:' || bringer when it names a seat, and the count trigger
-- takes it AFTER locking the bringer row — taking it here as well would add a
-- lock-order cycle. The UPDATE below takes the bringer row lock itself, and only
-- when the copy actually differs.

-- ── the name a +1 row carries, as every reader draws it — NULL when it has none ──
CREATE OR REPLACE FUNCTION public.guest_plus_one_seat_name(
  p_first        TEXT,
  p_last         TEXT,
  p_confirmed_at TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $name$
DECLARE
  v_f  TEXT := btrim(regexp_replace(COALESCE(p_first, ''), '\s+', ' ', 'g'));
  v_l  TEXT := btrim(regexp_replace(COALESCE(p_last, ''), '\s+', ' ', 'g'));
  v_fp BOOLEAN;
  v_lp BOOLEAN;
BEGIN
  -- `isPlaceholderSeat`: never named (no stamp) and still the seat engine's "TBA".
  IF p_confirmed_at IS NULL AND upper(v_f) = 'TBA' THEN
    RETURN NULL;
  END IF;
  -- `isPlaceholderNameWord` (lib/seat-placeholder-words.ts) — a seat label, "TBA", or a bare "+N".
  v_fp := v_f <> '' AND (v_f ~* '^\+\s*\d*\s*·?\s*TBA\y' OR v_f ~* '^TBA(\s+\+\d*)?$' OR v_f ~ '^\+\d*$');
  v_lp := v_l <> '' AND (v_l ~* '^\+\s*\d*\s*·?\s*TBA\y' OR v_l ~* '^TBA(\s+\+\d*)?$' OR v_l ~ '^\+\d*$');
  -- `realNameParts`: a stand-in part drops when the other is real; both stand-ins = no name.
  IF (v_fp OR v_f = '') AND (v_lp OR v_l = '') THEN
    RETURN NULL;
  END IF;
  RETURN NULLIF(btrim(concat_ws(' ', CASE WHEN v_fp THEN NULL ELSE NULLIF(v_f, '') END,
                                     CASE WHEN v_lp THEN NULL ELSE NULLIF(v_l, '') END)), '');
END;
$name$;

COMMENT ON FUNCTION public.guest_plus_one_seat_name(TEXT, TEXT, TIMESTAMPTZ) IS
  'The name a +1 seat row carries (first + last, stand-in words "TBA"/"+1" dropped), NULL for an unnamed seat — the SQL twin of isPlaceholderSeat + realNameParts.';

REVOKE ALL ON FUNCTION public.guest_plus_one_seat_name(TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_plus_one_seat_name(TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- ── the copy a bringer should carry: their oldest live named +1, else NULL ──
CREATE OR REPLACE FUNCTION public.guest_plus_one_name_of_rows(p_bringer_guest_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $of$
  SELECT n.name
    FROM (
      SELECT public.guest_plus_one_seat_name(s.first_name, s.last_name, s.plus_one_name_confirmed_at) AS name,
             s.created_at, s.guest_id
        FROM public.guests s
       WHERE s.plus_one_of_guest_id = p_bringer_guest_id
         AND s.guest_id <> p_bringer_guest_id
         AND s.deleted_at IS NULL
    ) AS n
   WHERE n.name IS NOT NULL
   ORDER BY n.created_at, n.guest_id
   LIMIT 1
$of$;

COMMENT ON FUNCTION public.guest_plus_one_name_of_rows(UUID) IS
  'The name of a bringer''s oldest live NAMED +1 row, or NULL — what guests.plus_one_name must say.';

REVOKE ALL ON FUNCTION public.guest_plus_one_name_of_rows(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_plus_one_name_of_rows(UUID) TO service_role;

-- ── set the copy — only when it differs, never on a removed bringer or on a +1 ──
CREATE OR REPLACE FUNCTION public.guest_plus_one_name_follows_rows(p_bringer_guest_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $follow$
DECLARE
  v_name TEXT;
  v_n    INTEGER;
BEGIN
  IF p_bringer_guest_id IS NULL THEN
    RETURN jsonb_build_object('status', 'missing_input');
  END IF;
  v_name := public.guest_plus_one_name_of_rows(p_bringer_guest_id);
  UPDATE public.guests
     SET plus_one_name = v_name
   WHERE guest_id = p_bringer_guest_id
     AND deleted_at IS NULL
     AND plus_one_of_guest_id IS NULL
     AND plus_one_name IS DISTINCT FROM v_name;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('status', 'ok', 'changed', v_n > 0, 'plus_one_name', v_name);
END;
$follow$;

COMMENT ON FUNCTION public.guest_plus_one_name_follows_rows(UUID) IS
  'Set a bringer''s guests.plus_one_name to the name of their oldest live named +1 row (NULL when none), only when it differs. Run by the a_plus_ones_name_is_their_row triggers; service_role may call it (backfills).';

REVOKE ALL ON FUNCTION public.guest_plus_one_name_follows_rows(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_plus_one_name_follows_rows(UUID) TO service_role;

-- ── the trigger: a NAMED +1 row appeared, went, came back, was renamed or moved ──
CREATE OR REPLACE FUNCTION public.a_plus_ones_name_is_their_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $trg$
DECLARE
  v_old_named BOOLEAN := FALSE;
  v_new_named BOOLEAN := FALSE;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_named := OLD.plus_one_of_guest_id IS NOT NULL
               AND OLD.plus_one_of_guest_id <> OLD.guest_id
               AND OLD.deleted_at IS NULL
               AND public.guest_plus_one_seat_name(OLD.first_name, OLD.last_name, OLD.plus_one_name_confirmed_at) IS NOT NULL;
  END IF;
  IF TG_OP IN ('UPDATE', 'INSERT') THEN
    v_new_named := NEW.plus_one_of_guest_id IS NOT NULL
               AND NEW.plus_one_of_guest_id <> NEW.guest_id
               AND NEW.deleted_at IS NULL
               AND public.guest_plus_one_seat_name(NEW.first_name, NEW.last_name, NEW.plus_one_name_confirmed_at) IS NOT NULL;
  END IF;
  IF NOT (v_old_named OR v_new_named) THEN
    RETURN NULL;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.plus_one_of_guest_id IS NOT NULL THEN
    PERFORM public.guest_plus_one_name_follows_rows(OLD.plus_one_of_guest_id);
  END IF;
  IF TG_OP IN ('UPDATE', 'INSERT') AND NEW.plus_one_of_guest_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.plus_one_of_guest_id IS DISTINCT FROM OLD.plus_one_of_guest_id) THEN
    PERFORM public.guest_plus_one_name_follows_rows(NEW.plus_one_of_guest_id);
  END IF;
  RETURN NULL;
END $trg$;

REVOKE EXECUTE ON FUNCTION public.a_plus_ones_name_is_their_row() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS a_plus_ones_name_is_their_row_ins ON public.guests;
CREATE TRIGGER a_plus_ones_name_is_their_row_ins
  AFTER INSERT ON public.guests
  FOR EACH ROW
  WHEN (NEW.plus_one_of_guest_id IS NOT NULL AND NEW.deleted_at IS NULL)
  EXECUTE FUNCTION public.a_plus_ones_name_is_their_row();

DROP TRIGGER IF EXISTS a_plus_ones_name_is_their_row_upd ON public.guests;
CREATE TRIGGER a_plus_ones_name_is_their_row_upd
  AFTER UPDATE ON public.guests
  FOR EACH ROW
  WHEN (
    (OLD.plus_one_of_guest_id IS NOT NULL OR NEW.plus_one_of_guest_id IS NOT NULL)
    AND (
      OLD.first_name IS DISTINCT FROM NEW.first_name
      OR OLD.last_name IS DISTINCT FROM NEW.last_name
      OR OLD.plus_one_name_confirmed_at IS DISTINCT FROM NEW.plus_one_name_confirmed_at
      OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
      OR OLD.plus_one_of_guest_id IS DISTINCT FROM NEW.plus_one_of_guest_id
    )
  )
  EXECUTE FUNCTION public.a_plus_ones_name_is_their_row();

DROP TRIGGER IF EXISTS a_plus_ones_name_is_their_row_del ON public.guests;
CREATE TRIGGER a_plus_ones_name_is_their_row_del
  AFTER DELETE ON public.guests
  FOR EACH ROW
  WHEN (OLD.plus_one_of_guest_id IS NOT NULL AND OLD.deleted_at IS NULL)
  EXECUTE FUNCTION public.a_plus_ones_name_is_their_row();
