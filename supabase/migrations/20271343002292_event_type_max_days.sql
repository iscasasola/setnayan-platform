-- event_type_max_days
--
-- Owner ruling 13 Nov 2026 (DECISION_LOG "DAYS PER EVENT TYPE"): every event
-- type runs a minimum of 1 day; the MAXIMUM is per type and admin-editable —
-- 30 = travel, tournament · 7 = wedding, debut, birthday, anniversary,
-- celebration, corporate, reunion, wake, graduation, concert ·
-- 1 = everything else (gala_night, christening, gender_reveal, date, hangout,
-- grand_opening, open_house, simple_event).
--
-- `max_days` becomes the source of truth. `multi_day` is KEPT (every reader,
-- the public-read RLS policy and the table GRANTs stay exactly as they are)
-- and is now DERIVED: a BEFORE INSERT/UPDATE trigger sets
-- multi_day := (max_days > 1). Why a trigger and not a GENERATED column:
-- seven already-applied migrations INSERT/UPDATE `multi_day` by name, and a
-- generated column refuses any write to it — a later migration or an admin
-- save naming it would fail. The trigger accepts the write and then makes the
-- column true to max_days, so the two can never disagree.
--
-- Additive: no column dropped, no policy touched.

ALTER TABLE public.event_type_profiles
  ADD COLUMN IF NOT EXISTS max_days smallint NOT NULL DEFAULT 1
    CHECK (max_days BETWEEN 1 AND 30);

COMMENT ON COLUMN public.event_type_profiles.max_days IS
  'The longest an event of this type may run, in days (1-30; minimum is always 1). Source of truth for the event span; multi_day is derived from it (max_days > 1). Owner ruling 2026-11-13.';

UPDATE public.event_type_profiles SET max_days = 30
 WHERE event_type IN ('travel', 'tournament');

UPDATE public.event_type_profiles SET max_days = 7
 WHERE event_type IN ('wedding', 'debut', 'birthday', 'anniversary', 'celebration',
                      'corporate', 'reunion', 'wake', 'graduation', 'concert');

-- Everything else keeps the column default of 1.

CREATE OR REPLACE FUNCTION public.event_type_profiles_sync_multi_day()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.multi_day := (NEW.max_days > 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_type_profiles_sync_multi_day ON public.event_type_profiles;
CREATE TRIGGER event_type_profiles_sync_multi_day
  BEFORE INSERT OR UPDATE ON public.event_type_profiles
  FOR EACH ROW EXECUTE FUNCTION public.event_type_profiles_sync_multi_day();

-- Bring every existing row in line (the trigger fires on this no-op update).
UPDATE public.event_type_profiles SET max_days = max_days;
