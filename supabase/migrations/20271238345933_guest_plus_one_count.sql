-- guest_plus_one_count
-- Created via `pnpm migration:new`. Idempotent.
--
-- ⚖ OWNER 2026-09-21: "+1 per guest can be up to number 4. can be
-- +1/+2/+3/+4. these are for the additional seats."
--
-- Until now a plus-one was a BOOLEAN (`plus_one_allowed`, since the first
-- guests migration). The capture bar already parsed "+3" — and stored `true`,
-- so a couple who typed "+3" got ONE extra seat and nothing said so. This adds
-- the number.
--
-- ── ONE FACT, TWO COLUMNS, KEPT EQUAL ─────────────────────────────────────
-- `plus_one_allowed` is read in ~15 places (the RSVP widget, the seat chip, the
-- 3D seating lab, CSV import, the guest-detail form…). Rather than rewrite every
-- reader in one change, the boolean stays and is DERIVED: a trigger keeps
-- `plus_one_allowed = (plus_one_count > 0)` on every write, whichever column
-- the writer touched. A reader that only knows the boolean still gets a true
-- answer ("may bring someone"); a reader that needs seats reads the count.
--
--   INSERT: the count wins when given (> 0); otherwise a legacy
--           `plus_one_allowed = true` means one.
--   UPDATE: whichever column CHANGED wins. A count change sets the boolean; a
--           boolean-only change sets the count to 1 (on) or 0 (off) — turning
--           an existing +3 "on" again never shrinks it to +1.
--
-- 🔑 NOT NULL DEFAULT 0 is safe with this trigger because it never asks "was a
-- value written" of a defaulted column — it compares to OLD on UPDATE, and on
-- INSERT treats 0 as "not given" (0 and "none" mean the same thing here).

ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS plus_one_count SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE public.guests DROP CONSTRAINT IF EXISTS guests_plus_one_count_range;
ALTER TABLE public.guests
  ADD CONSTRAINT guests_plus_one_count_range CHECK (plus_one_count BETWEEN 0 AND 4);

COMMENT ON COLUMN public.guests.plus_one_count IS
  'Extra seats this guest may bring: 0 (none) to 4 (owner 2026-09-21: "+1/+2/+3/+4 … for the '
  'additional seats"). plus_one_allowed is kept equal to (plus_one_count > 0) by '
  'guests_plus_one_count_sync_trg — write either; read the count for seats.';

-- Existing permissions become one seat each — exactly what they meant before.
UPDATE public.guests SET plus_one_count = 1
 WHERE plus_one_allowed AND plus_one_count = 0;

CREATE OR REPLACE FUNCTION public.guests_plus_one_count_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.plus_one_count > 0 THEN
      NEW.plus_one_allowed := true;
    ELSIF NEW.plus_one_allowed THEN
      NEW.plus_one_count := 1;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.plus_one_count IS DISTINCT FROM OLD.plus_one_count THEN
    NEW.plus_one_allowed := NEW.plus_one_count > 0;
  ELSIF NEW.plus_one_allowed IS DISTINCT FROM OLD.plus_one_allowed THEN
    NEW.plus_one_count := CASE
      WHEN NOT NEW.plus_one_allowed THEN 0
      ELSE GREATEST(OLD.plus_one_count, 1)
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guests_plus_one_count_sync_trg ON public.guests;
CREATE TRIGGER guests_plus_one_count_sync_trg
  BEFORE INSERT OR UPDATE ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.guests_plus_one_count_sync();

-- A trigger function is not an API: nobody calls it directly.
REVOKE EXECUTE ON FUNCTION public.guests_plus_one_count_sync() FROM PUBLIC;

-- ── POST-CONDITION ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.guests
     WHERE plus_one_allowed IS DISTINCT FROM (plus_one_count > 0)
  ) THEN
    RAISE EXCEPTION 'plus_one_allowed and plus_one_count disagree after the backfill';
  END IF;
END $$;
