-- 20260804000000_add_chinese_ceremony_type.sql
-- Owner-directed 2026-06-03: "on weddings, also add chinese wedding."
--
-- Adds 'chinese' (a Chinese / Tsinoy wedding — tea ceremony + Chinese customs,
-- often paired with a church or civil rite) as a wedding ceremony type.
--
-- It launches COMING SOON: surfaced in the create-event picker + onboarding so
-- couples see it on the roadmap, but not yet selectable. Owner intent —
-- "show them and prepare these different wedding religions when the vendors are
-- enough to cater their service." An admin flips the launch-status row to
-- 'active' (and the matching ALLOWED_CEREMONIES code list is widened) once
-- Chinese-wedding vendor density is sufficient — the same gating the other
-- faiths used before the 2026-06-03 "unlock all religions" change.
--
-- This migration only WIDENS the four enum-style CHECK constraints to PERMIT
-- 'chinese' (so activation later needs no further migration) and seeds the
-- launch-status row as coming_soon. Idempotent + re-runnable.

-- 1. events.ceremony_type — preserve the iteration-0041 NULL allowance
--    (non-wedding event_types store NULL on the wedding-specific columns).
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_ceremony_type_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_ceremony_type_check
  CHECK (
    ceremony_type IS NULL
    OR ceremony_type IN ('catholic','civil','inc','christian','muslim','cultural','chinese','mixed')
  );

-- 2. events.secondary_ceremony_type — the second rite of a Mixed/interfaith
--    wedding (e.g. Catholic primary + Chinese tea ceremony).
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_secondary_ceremony_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_secondary_ceremony_check
  CHECK (
    secondary_ceremony_type IS NULL
    OR secondary_ceremony_type IN ('catholic','civil','inc','christian','muslim','cultural','chinese')
  );

-- 3. wedding_type_launch_status.ceremony_type — an INLINE column CHECK in the
--    0043 migration, so its auto-generated name is implementation-defined.
--    Drop it by catalog lookup (match by column reference, robust to the
--    IN()-vs-ANY(ARRAY) rendering Postgres may normalise to), then re-add a
--    stably-named one widened for 'chinese'.
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
  WHERE conrelid = 'public.wedding_type_launch_status'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%ceremony_type%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.wedding_type_launch_status DROP CONSTRAINT %I', cname);
  END IF;
END $$;
ALTER TABLE public.wedding_type_launch_status
  ADD CONSTRAINT wedding_type_launch_status_ceremony_type_check
  CHECK (ceremony_type IN ('catholic','civil','inc','christian','muslim','cultural','chinese'));

-- 4. couple_wedding_type_notify_signups.ceremony_type_interested — also an
--    inline CHECK (its conventional auto-name would exceed 63 chars and be
--    truncated, so catalog lookup is the safe drop).
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
  WHERE conrelid = 'public.couple_wedding_type_notify_signups'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%ceremony_type_interested%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.couple_wedding_type_notify_signups DROP CONSTRAINT %I', cname);
  END IF;
END $$;
ALTER TABLE public.couple_wedding_type_notify_signups
  ADD CONSTRAINT couple_wedding_type_notify_signups_ceremony_interested_check
  CHECK (ceremony_type_interested IN ('catholic','civil','inc','christian','muslim','cultural','chinese'));

-- 5. Seed the launch-status row as coming_soon (the lone gated faith now that
--    the others were unlocked 2026-06-03). ON CONFLICT keeps it idempotent and
--    preserves any later admin edit to status / thresholds.
INSERT INTO public.wedding_type_launch_status (ceremony_type, region, status, activated_at)
VALUES ('chinese', 'all', 'coming_soon', NULL)
ON CONFLICT (ceremony_type, region) DO NOTHING;
