-- Budget "Build" — RELAX budget_builds for free-form NAMED saved builds.
-- Design: Build_3State_Solver_2026-06-16.md (named Save-As → Compare).
--
-- The original table (migration 20260926000000) caps a couple to three saved
-- builds via `label TEXT NOT NULL CHECK (label IN ('A','B','C'))` + a UNIQUE
-- (event_id, label) index. The 3-state Build replaces that fixed A/B/C cap with
-- N free-form NAMED builds: a build is identified by its `build_id` + free-form
-- `title`, with `label` no longer required.
--
-- This migration is RELAX-ONLY + ADDITIVE:
--   • Drops the NOT NULL + CHECK on `label` (label becomes nullable & free).
--   • KEEPS the (event_id, label) UNIQUE index FULL (not partial). Once `label`
--     is nullable, Postgres NULLS-DISTINCT semantics let UNLIMITED named builds
--     (label NULL — each (event_id, NULL) is distinct) coexist while A/B/C labels
--     stay one-per-event, AND the legacy `onConflict: event_id,label` upsert
--     (savePlanBuild) STILL infers it. A PARTIAL index would break that upsert:
--     ON CONFLICT (event_id, label) cannot infer a partial index without also
--     specifying its predicate, which PostgREST's onConflict does not emit.
--   • Adds a plain (event_id, created_at) index for stable named-build ordering.
--
-- Existing A/B/C rows keep working untouched (they have non-null labels that
-- still satisfy the partial unique index). No data is moved or deleted. The
-- named Save-As path is read/written ONLY behind BUILD_3STATE_ENABLED, so this
-- changes nothing in production until that flag is flipped. RLS is unchanged
-- (the four couple-own policies from 20260926000000 / the RLS migration still
-- apply — they key on event_id, not label).

-- 1. Drop the NOT NULL + 'A'|'B'|'C' CHECK on label (relax to nullable/free-form).
--    The CHECK constraint name is Postgres-auto-generated; drop by predicate via
--    a DO block so this is name-agnostic and idempotent.
ALTER TABLE public.budget_builds
  ALTER COLUMN label DROP NOT NULL;

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'budget_builds'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%label%'
      AND pg_get_constraintdef(con.oid) ILIKE '%''A''%'
  LOOP
    EXECUTE format('ALTER TABLE public.budget_builds DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- 2. KEEP the (event_id, label) UNIQUE index FULL (the original from
--    20260926000000 already is). With `label` now nullable, NULLS-DISTINCT lets
--    UNLIMITED named builds (label NULL) coexist while A/B/C stays one-per-event,
--    and the legacy ON CONFLICT (event_id, label) upsert still infers it. The
--    CREATE IF NOT EXISTS is a defensive no-op (the index already exists); we do
--    NOT drop+replace it with a partial, which would break that legacy upsert.
CREATE UNIQUE INDEX IF NOT EXISTS budget_builds_event_label_idx
  ON public.budget_builds (event_id, label);

-- 3. Stable ordering for named builds (no label to order by): newest-first per event.
CREATE INDEX IF NOT EXISTS budget_builds_event_created_idx
  ON public.budget_builds (event_id, created_at);

COMMENT ON COLUMN public.budget_builds.label IS
  'Legacy A/B/C slot label (nullable since 20261231010000). NULL = a free-form NAMED build (identified by build_id + title) under the 3-state Build (BUILD_3STATE_ENABLED). Non-null A/B/C labels stay one-per-event via the partial unique index.';
