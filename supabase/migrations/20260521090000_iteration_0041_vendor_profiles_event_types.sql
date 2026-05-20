-- ============================================================================
-- 20260521090000_iteration_0041_vendor_profiles_event_types.sql
--
-- Iteration 0041 — Multi-event support. Adds `event_types TEXT[]` to
-- vendor_profiles so the marketplace can filter vendors by which event
-- types they actually serve.
--
-- Spec corpus: 0041_multi_event_support/0041_multi_event_support.md § 2
-- ("vendor's `vendor_profiles.event_types[]`").
--
-- Default `['wedding']` mirrors V1 reality — every existing vendor profile
-- was onboarded under the wedding-only roster. The backfill is automatic
-- via the column default; the explicit UPDATE is defensive in case any row
-- somehow ends up with NULL or an empty array.
--
-- A GIN index keeps the @> / && containment queries fast for the
-- marketplace filter sidebar. The CHECK constraint validates that every
-- entry is a known event_type enum value — kept in sync manually since
-- TEXT[] columns don't auto-validate against enums; update this CHECK
-- when a new event_type enum value is added to public.event_type.
--
-- Idempotent — IF NOT EXISTS + DROP IF EXISTS pattern; re-run is a no-op.
-- ============================================================================

BEGIN;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS event_types TEXT[]
    NOT NULL DEFAULT ARRAY['wedding']::TEXT[];

-- Safety backfill (the column default handles new rows; this ensures any
-- legacy NULLs or empties from prior migrations land at the V1 baseline).
UPDATE public.vendor_profiles
SET event_types = ARRAY['wedding']::TEXT[]
WHERE event_types IS NULL OR cardinality(event_types) = 0;

CREATE INDEX IF NOT EXISTS vendor_profiles_event_types_gin
  ON public.vendor_profiles USING GIN (event_types);

-- Each entry must be a member of the current public.event_type enum.
-- When a new event_type value lands (e.g. birthday in V1.2, baptism in
-- V1.3), update both the enum migration AND this CHECK constraint so
-- vendors can opt into the new type. Keep the list alphabetical for diff
-- readability.
ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_event_types_check;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_event_types_check
  CHECK (
    cardinality(event_types) > 0
    AND event_types <@ ARRAY[
      'birthday',
      'celebration',
      'christening',
      'corporate',
      'debut',
      'gender_reveal',
      'tournament',
      'travel',
      'wedding'
    ]::TEXT[]
  );

COMMIT;
