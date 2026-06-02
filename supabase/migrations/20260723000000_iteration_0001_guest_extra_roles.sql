-- Iteration 0001 — multi-role guests (2026-06-02)
--
-- A guest's `role` stays the SINGLE primary role that drives the seating
-- ring/tier (iteration 0008 auto-fill), the avatar, the per-role invite
-- defaults, and the bride/groom one-per-event partial-unique indexes.
-- `extra_roles` holds any ADDITIONAL hats the same person wears (e.g. a
-- Bridesmaid who is also a Principal Sponsor) — shown as secondary chips
-- and matched by the role-group filter, but never changing the seating
-- tier. Additive + nullable-with-default so existing rows + every read
-- path keep working untouched.
--
-- Bride/Groom are singletons (one per event); the partial-unique indexes
-- only cover the primary `role` column, so a CHECK keeps them out of
-- `extra_roles` as defence in depth (the app guards too).

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS extra_roles public.guest_role[] NOT NULL DEFAULT '{}'::public.guest_role[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'guests_extra_roles_no_singletons'
      AND conrelid = 'public.guests'::regclass
  ) THEN
    ALTER TABLE public.guests
      ADD CONSTRAINT guests_extra_roles_no_singletons
      CHECK (
        NOT (extra_roles && ARRAY['bride', 'groom']::public.guest_role[])
      );
  END IF;
END$$;

COMMENT ON COLUMN public.guests.extra_roles IS
  'Additional roles a guest carries beyond the primary `role` (multi-role). '
  'Primary `role` still drives seating tier + invite defaults; bride/groom '
  'are excluded by guests_extra_roles_no_singletons (one per event).';
