-- 20260806000000_activate_chinese_ceremony.sql
-- Owner-directed 2026-06-03: "fix all gaps and adjust our wedding onboarding to
-- be able to cater all different religious weddings."
--
-- 20260804 added 'chinese' as a PERMITTED ceremony type but launched it
-- coming_soon (gated on vendor density). This flips it to ACTIVE so the onboarding
-- + create-event flows offer Chinese weddings like the other faiths.
--
-- SELF-SUFFICIENT + idempotent: re-asserts the constraint widening (so this works
-- even if it reaches a database before 20260804) then upserts the launch-status
-- row to 'active'. Safe to re-run; never downgrades an existing active row.

-- Permit 'chinese' on the events ceremony constraints (idempotent re-assert;
-- preserves the iteration-0041 NULL allowance for non-wedding event_types).
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_ceremony_type_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_ceremony_type_check
  CHECK (
    ceremony_type IS NULL
    OR ceremony_type IN ('catholic','civil','inc','christian','muslim','cultural','chinese','mixed')
  );

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_secondary_ceremony_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_secondary_ceremony_check
  CHECK (
    secondary_ceremony_type IS NULL
    OR secondary_ceremony_type IN ('catholic','civil','inc','christian','muslim','cultural','chinese')
  );

-- Permit 'chinese' in wedding_type_launch_status (inline CHECK from 0043 has an
-- implementation-defined name — drop by catalog lookup, then re-add stably named).
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

-- Activate Chinese everywhere (region='all'). Upsert so it works whether the
-- row exists (from 20260804) or not; never downgrades a row already active.
INSERT INTO public.wedding_type_launch_status (ceremony_type, region, status, activated_at)
VALUES ('chinese', 'all', 'active', NOW())
ON CONFLICT (ceremony_type, region) DO UPDATE
  SET status       = 'active',
      activated_at = COALESCE(public.wedding_type_launch_status.activated_at, NOW()),
      updated_at   = NOW();
