-- panood_first_live_at
--
-- Anchors the Live Studio paid broadcast window (owner-locked 2026-07-21).
--
-- The model: the free tier is fully functional but every video surface carries a full-screen
-- SETNAYAN overlay. ONE instant does two things — pressing Go live on a PAID event clears the
-- overlay AND opens a 24-hour window. Before that instant, paid or not, the overlay is on
-- ("pressing live. until then, we only promote setnayan").
--
-- Why a dedicated column rather than reusing is_live / updated_at: `is_live` is a toggle an
-- operator flips off and on during an event, and `updated_at` moves on every unrelated control
-- change. The window must anchor to the FIRST press and never move, or stopping and restarting
-- a broadcast would silently extend a paid window. This column is therefore WRITE-ONCE.
--
-- Set via COALESCE(first_live_at, now()) on the go-live path so a re-press is a no-op, and
-- enforced below by a trigger so no future code path can move it either.
--
-- Idempotent.

ALTER TABLE public.panood_control_state
  ADD COLUMN IF NOT EXISTS first_live_at TIMESTAMPTZ;

COMMENT ON COLUMN public.panood_control_state.first_live_at IS
  'Write-once UTC timestamp of the FIRST press-live for this event. Anchors the 24h paid broadcast window (lib/panood-watermark). Never moved by a re-press — enforced by trg_panood_first_live_at_immutable.';

-- Backfill: any event already marked live before this migration gets its window anchored to the
-- last control-state write, the closest honest approximation of when it went live. Without this
-- an in-flight event would read as "never pressed live" and regain the overlay.
UPDATE public.panood_control_state
SET    first_live_at = COALESCE(updated_at, now())
WHERE  is_live = TRUE
  AND  first_live_at IS NULL;

-- Immutability guard. Once stamped, first_live_at cannot be moved or cleared by ANY write path
-- (a moved anchor silently extends a paid window; a cleared one hands out a fresh 24 hours).
CREATE OR REPLACE FUNCTION public.panood_first_live_at_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.first_live_at IS NOT NULL
     AND NEW.first_live_at IS DISTINCT FROM OLD.first_live_at THEN
    -- Silently preserve rather than RAISE: this fires inside best-effort control-plane writes
    -- during a live event, and a hard error here would break camera switching mid-ceremony over
    -- a field the operator never touched.
    NEW.first_live_at := OLD.first_live_at;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_panood_first_live_at_immutable ON public.panood_control_state;
CREATE TRIGGER trg_panood_first_live_at_immutable
  BEFORE UPDATE ON public.panood_control_state
  FOR EACH ROW
  EXECUTE FUNCTION public.panood_first_live_at_immutable();
