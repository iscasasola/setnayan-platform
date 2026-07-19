-- event_members_account_autosurface
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- Smart seat-plan · account auto-surface (#7b) — SCHEMA ONLY, ships FLAG-OFF.
--
-- When a couple adds a guest whose person resolves to an already-claimed Setnayan
-- account, the event can be auto-surfaced into that account's picker (owner:
-- "the event is sent whether they accept or not; only if they say NO is it not
-- included"). Inclusion-by-default is the RA 10173-sensitive part, so the app-side
-- surfacing is gated behind FEATURE_ACCOUNT_AUTOSURFACE (default OFF) and blocked
-- on external PH counsel. These columns + the decline-hide trigger are inert until
-- that flag flips (no auto_surfaced rows exist while it's off).
--
-- auto_surfaced = this membership was created by the auto-surface path (vs a real
--                 join). hidden_at = the guest opted OUT ("no" = decline OR leave);
--                 the event picker filters these out.
ALTER TABLE public.event_members
  ADD COLUMN IF NOT EXISTS auto_surfaced BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

COMMENT ON COLUMN public.event_members.auto_surfaced IS
  'Account auto-surface (#7b, flag-gated): TRUE = membership created by the auto-surface path, not an explicit join.';
COMMENT ON COLUMN public.event_members.hidden_at IS
  'Account auto-surface opt-out: set when the guest said NO (declined or left); the event picker hides these rows.';

-- "No" path #1 (RSVP decline) — one chokepoint that covers every decline path
-- (public RSVP, dashboard edit, bulk, import, API), mirroring free_seat_on_decline.
-- Hides the auto-surfaced event for the declining guest's claimed account. Inert
-- while the feature is off (no auto_surfaced rows to hit). SECURITY DEFINER because
-- the public RSVP path runs as the guest, who has no write on event_members.
CREATE OR REPLACE FUNCTION public.hide_autosurfaced_on_decline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.event_members em
     SET hidden_at = NOW()
    FROM public.people p
   WHERE p.person_id = NEW.person_id
     AND p.claimed_by_user_id IS NOT NULL
     AND em.event_id = NEW.event_id
     AND em.user_id = p.claimed_by_user_id
     AND em.auto_surfaced = TRUE
     AND em.hidden_at IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guests_hide_autosurfaced_on_decline ON public.guests;
CREATE TRIGGER guests_hide_autosurfaced_on_decline
  AFTER UPDATE OF rsvp_status ON public.guests
  FOR EACH ROW
  WHEN (
    NEW.rsvp_status = 'declined'
    AND OLD.rsvp_status IS DISTINCT FROM 'declined'
    AND NEW.person_id IS NOT NULL
  )
  EXECUTE FUNCTION public.hide_autosurfaced_on_decline();
