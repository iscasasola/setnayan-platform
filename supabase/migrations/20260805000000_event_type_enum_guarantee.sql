-- 20260805000000_event_type_enum_guarantee.sql
-- Guarantee the public.event_type enum carries every value the create-event
-- picker can emit, and add three roadmap types as seedable values.
--
-- Owner-directed 2026-06-03 ("keep everything live"): the picker shows all
-- event types live. `debut` + `gender_reveal` were already added in iteration
-- 0041 (20260521050000 / 20260521060000) and verified against prod by PR #884;
-- these IF-NOT-EXISTS re-adds are a harmless belt-and-suspenders so a fresh or
-- replayed database can never reject a Debut insert. `anniversary`,
-- `graduation`, `reunion` are NEW seedable values — not yet shown in the UI
-- roster, but adding them to the enum now means surfacing them later is a
-- picker-config change with no migration.
--
-- Postgres requires one ADD VALUE per statement; IF NOT EXISTS keeps re-runs
-- idempotent. ADD VALUE inside a transaction is allowed (PG12+) as long as the
-- new value isn't used in the same transaction — it isn't here. Mirrors the
-- applied 20260621000000 attire-enum migration.

BEGIN;

ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'debut';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'gender_reveal';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'anniversary';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'graduation';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'reunion';

COMMIT;
