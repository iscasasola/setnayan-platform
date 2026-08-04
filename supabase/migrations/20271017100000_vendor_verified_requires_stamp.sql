-- vendor_verified_requires_stamp
-- (Numbered ABOVE the current applied head — a migration numbered below it is
--  silently skipped by the auto-apply path.)
-- ============================================================================
-- INTEGRITY GUARANTEE — a shop cannot be 'verified' without a verification DATE.
--
-- ── THE BAD ROW ─────────────────────────────────────────────────────────────
-- Production holds a `vendor_profiles` row at `verification_state = 'verified'`
-- with NULL `last_verified_at`, NULL `next_renewal_due_at`, and NO
-- `vendor_tier_history` row. It carries the public "Verified" badge — the thing
-- that tells a couple this business was checked by a human — while no human ever
-- checked it and no record says when.
--
-- ── WHY NO APP PATH EXPLAINS IT ─────────────────────────────────────────────
-- Both admin writers set all three fields in a SINGLE UPDATE statement:
--   • app/admin/verify/actions.ts:149-151  (visibility → 'verified')
--   • app/admin/verify/actions.ts:361-362  (applyApplicationDecision 'approved')
-- Both also bump `updated_at`. The prod row's `updated_at` is byte-identical to
-- its `created_at`, so it was never UPDATEd by either. The reachable shapes that
-- CAN produce it both bypass the app entirely:
--   • apps/web/scripts/seed-test-accounts.sql — sets verification_state =
--     'verified', stamps nothing, and its own header documents running it
--     against PROD via `--db-url`.  (Fixed in this PR.)
--   • migration 20270331400000:41-44 — `UPDATE … SET verification_state =
--     'verified' WHERE tier_state <> 'free'`, same shape.
-- The offending row is attached to testnayan1@test.com, named "TEST Floor Co
-- (seed)" — i.e. the seed script is the overwhelmingly likely origin.
--
-- ── WHY A CHECK CONSTRAINT ──────────────────────────────────────────────────
-- The defect class is "a writer that isn't the app" — a migration, a seed
-- script, a hand-run psql session. An application-layer fix cannot reach any of
-- those. A CHECK constraint is enforced by the ENGINE against every writer
-- including `service_role` and superuser DML, which is exactly the blast radius
-- required. A trigger would work too but is bypassable (ALTER TABLE … DISABLE
-- TRIGGER) and costs a function call per write; a CHECK is declarative and free.
--
-- It REJECTS rather than backfills on purpose: no truthful `last_verified_at`
-- exists for a row nobody verified, and inventing one would launder an unchecked
-- business into a checked-looking one. That is the whole failure being closed.
--
-- ── PROVED SAFE AGAINST EVERY LEGITIMATE WRITER ─────────────────────────────
-- Audited every writer of `verification_state = 'verified'` in the tree
-- (the rest of the ~30 grep hits are READS — `.eq(...)` filters and
-- `=== 'verified'` comparisons):
--   1. admin/verify/actions.ts:149-151 — `updatePayload` carries
--      verification_state + last_verified_at + next_renewal_due_at → ONE
--      UPDATE, so no transient violating state is ever visible to the check.
--   2. admin/verify/actions.ts:361-362 — `approveSideEffects` is spread into
--      the SAME `vendorUpdatePayload` as `verification_state: toState`. Ditto.
--   3. the seed script + migration 20270331400000 — the two offenders. The seed
--      is corrected in this PR; 20270331400000 already ran and is immutable
--      history (see the NOT VALID note below for how that is handled).
-- No path sets 'verified' in one statement and the timestamp in another, so
-- nothing legitimate is broken. `tests/db/vendor-verified-stamp-integrity.db.test.ts`
-- pins all of this against replayed SQL.
--
-- Only `last_verified_at` is required, NOT `next_renewal_due_at`: the former is
-- a statement of fact (this was checked, on this date) and its absence is what
-- makes the badge a lie. The latter is a derived scheduling value, and requiring
-- it would couple this integrity rule to renewal policy that the owner may
-- legitimately change.
--
-- ── ⚠ NOT VALID — AND WHY THIS MIGRATION IS SAFE TO DEPLOY TODAY ───────────
-- A plain `ADD CONSTRAINT` validates every existing row and would therefore
-- ABORT on production while the bad row is still there — blocking this deploy
-- (and every later migration) on a manual data decision.
--
-- `NOT VALID` skips only the initial full-table scan. The constraint is FULLY
-- ENFORCED on every INSERT and every UPDATE from the moment it is added, so the
-- hole closes immediately for all future writers, which is the point of the fix.
-- The single pre-existing row is grandfathered until the owner resolves it.
--
-- OWNER RUNBOOK — the order matters:
--   1. Deploy this migration. (Safe with the bad row present.)
--   2. Resolve the row — recommended: DELETE it. See the PR body for the exact
--      SQL and the reasoning (nothing depends on it; no truthful timestamp
--      exists to backfill).
--   3. THEN, and only then, promote the constraint to fully validated:
--        ALTER TABLE public.vendor_profiles
--          VALIDATE CONSTRAINT vendor_profiles_verified_requires_stamp;
--      This takes only a SHARE UPDATE EXCLUSIVE lock (concurrent reads and
--      writes continue) and will ERROR if any violating row remains — making it
--      a safe, repeatable check that step 2 is complete.
-- Steps 2 and 3 are deliberately NOT automated here: this migration must never
-- delete or rewrite production data on its own.
-- ============================================================================

BEGIN;

ALTER TABLE public.vendor_profiles
  DROP CONSTRAINT IF EXISTS vendor_profiles_verified_requires_stamp;

ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_verified_requires_stamp
  CHECK (
    verification_state <> 'verified'::public.vendor_verification_state
    OR last_verified_at IS NOT NULL
  )
  NOT VALID;

COMMENT ON CONSTRAINT vendor_profiles_verified_requires_stamp
  ON public.vendor_profiles IS
  'A shop carrying the public Verified badge must record WHEN it was verified. '
  'Blocks the seed-script / hand-run-SQL shape that produced a verified row with '
  'a NULL last_verified_at and no vendor_tier_history entry. Added NOT VALID so '
  'it enforces on all new writes while one known pre-existing row awaits an '
  'owner decision; run VALIDATE CONSTRAINT once that row is resolved.';

-- ── Post-conditions ─────────────────────────────────────────────────────────
-- These assert STRUCTURE only. They deliberately do NOT exercise the constraint
-- by writing to `vendor_profiles`: a probe UPDATE would touch a real production
-- row, and `vendor_profiles` carries other triggers whose unrelated exceptions
-- could abort this migration for the wrong reason. Behavioural proof that the
-- constraint actually REJECTS the bad shape (and still ACCEPTS every legitimate
-- one) lives in tests/db/vendor-verified-stamp-integrity.db.test.ts, which
-- replays these migrations into a throwaway PGlite database.
DO $$
DECLARE
  v_def TEXT;
  v_offenders BIGINT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conrelid = 'public.vendor_profiles'::regclass
     AND conname  = 'vendor_profiles_verified_requires_stamp'
     AND contype  = 'c';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'POST-CONDITION FAILED: CHECK constraint vendor_profiles_verified_requires_stamp was not created.';
  END IF;

  IF v_def NOT LIKE '%last_verified_at%' THEN
    RAISE EXCEPTION
      'POST-CONDITION FAILED: constraint does not reference last_verified_at. Definition: %',
      v_def;
  END IF;

  SELECT COUNT(*) INTO v_offenders
    FROM public.vendor_profiles
   WHERE verification_state = 'verified'::public.vendor_verification_state
     AND last_verified_at IS NULL;

  IF v_offenders > 0 THEN
    RAISE WARNING
      'vendor_profiles: % pre-existing row(s) violate vendor_profiles_verified_requires_stamp. '
      'The constraint is ENFORCED for every new INSERT/UPDATE (NOT VALID skips only the '
      'initial scan). Resolve the row(s), then run: ALTER TABLE public.vendor_profiles '
      'VALIDATE CONSTRAINT vendor_profiles_verified_requires_stamp;',
      v_offenders;
  ELSE
    RAISE NOTICE
      'vendor_profiles: no violating rows — safe to run VALIDATE CONSTRAINT now.';
  END IF;
END $$;

COMMIT;
