-- muslim_event_nikah_fields
-- Muslim wedding track — event-level Nikah details + the wali/imam/wakil
-- one-per-event guards.
--
-- COLUMNS (all on public.events, all additive + nullable-or-defaulted so they
-- don't disturb the events_wedding_fields_consistency biconditional, which only
-- gates ceremony_type + venue_setting):
--   • mahr_description   — the groom's mandatory gift to the bride (hers alone).
--                          Free text because the mahr can be cash, gold, property
--                          OR something symbolic — Setnayan never processes it and
--                          never charges on it (it is NOT a vendor/platform line).
--   • mahr_prompt_deferred — small state enum for the onboarding flow: 'deferred'
--                          (not asked yet), 'pending' (asked, awaiting), 'provided'
--                          (the couple set a description). Nullable for non-muslim.
--   • gender_separation  — the walima seating posture the couple controls:
--                          'none' (default — most Filipino-Muslim weddings are
--                          mixed), 'sections' (men's/women's sections), or
--                          'separate_spaces'. NOT NULL DEFAULT 'none' is safe: it
--                          self-backfills every existing row (incl. non-weddings)
--                          to the neutral value and is not part of the wedding-
--                          fields consistency constraint.
--
-- SINGLETON INDEXES: wali, imam, wakil are at-most-one-per-event (the existing
-- bride/groom pattern from 20260531010000). witness is intentionally NOT indexed
-- — a nikah needs at least TWO witnesses, which a partial UNIQUE index cannot
-- express; the >=2 floor is surfaced advisorily by the Nikah-essentials card.
-- These reference enum values added in 20270308910536 (a prior, already-committed
-- migration), so the WHERE-clause literals resolve.

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS mahr_description    TEXT,
  ADD COLUMN IF NOT EXISTS mahr_prompt_deferred TEXT,
  ADD COLUMN IF NOT EXISTS gender_separation    TEXT NOT NULL DEFAULT 'none';

-- Belt-and-suspenders CHECKs (the TS layer validates too). Idempotent via
-- DROP IF EXISTS + ADD (constraints have no IF NOT EXISTS).
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_mahr_prompt_deferred_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_mahr_prompt_deferred_check
  CHECK (
    mahr_prompt_deferred IS NULL
    OR mahr_prompt_deferred IN ('deferred', 'pending', 'provided')
  );

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_gender_separation_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_gender_separation_check
  CHECK (gender_separation IN ('none', 'sections', 'separate_spaces'));

COMMIT;

-- Singleton guards (own transaction; CREATE UNIQUE INDEX is non-CONCURRENT so a
-- plain BEGIN/COMMIT is fine). Soft-deleted guests don't count, mirroring the
-- bride/groom indexes — so the couple can re-cast a role after removing a guest.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS guests_one_wali_per_event
  ON public.guests (event_id)
  WHERE role = 'wali' AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS guests_one_imam_per_event
  ON public.guests (event_id)
  WHERE role = 'imam' AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS guests_one_wakil_per_event
  ON public.guests (event_id)
  WHERE role = 'wakil' AND deleted_at IS NULL;

COMMIT;
