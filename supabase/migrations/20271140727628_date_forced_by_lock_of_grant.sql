-- date_forced_by_lock_of_grant — the column that made "locking a supplier sets
-- your date" a feature that has never once run.
--
-- ── WHAT WAS BROKEN, MEASURED IN PROD 2026-08-13 ──────────────────────────
-- Owner's rule: when you lock a service, the date options shrink to that
-- supplier's availability, until either the couple picks from what remains or a
-- single date forms in common. `finalizeVendor` implements the moment the date
-- FORMS -- one UPDATE writing six columns:
--
--     event_date, event_date_precision, date_status,
--     auspicious_reasons, date_forced_by_lock_of      <- this one
--
-- Five of the six are grantable by a couple's session. The sixth is not:
--
--     date_forced_by_lock_of   authenticated=false  anon=false
--     event_date               authenticated=true   anon=true
--     event_date_precision     authenticated=true   anon=true
--     date_status              authenticated=true   anon=true
--     date_candidates          authenticated=true   anon=true
--     auspicious_reasons       authenticated=true   anon=true
--
-- 🔑 POSTGRES CHECKS PRIVILEGES AGAINST THE COLUMNS **NAMED**, NOT THE VALUES
-- CHANGED. One ungranted column in the list rejects the WHOLE statement, 42501.
-- So the write has failed every single time, and a rejected query is not a
-- thrown error -- `dateLockedNow` simply stayed false and nobody was told.
-- Prod: **0 events have ever had `date_forced_by_lock_of` set.** Not one, ever.
--
-- ── WHY IT HAPPENED — THE TRAP, NOT A DECISION ─────────────────────────────
-- This is NOT a deliberate withholding. The column is absent from the deny-set
-- in `apps/web/lib/security/events-column-privileges.ts`, whose own inclusion
-- rule requires "no authenticated-client write path touches it" -- and
-- `finalizeVendor` is exactly such a path, on the user's RLS client.
--
-- What happened is the trap this project keeps paying for: **A NEW COLUMN
-- INHERITS NO COLUMN-LEVEL GRANTS.** `public.events` has NO table-level UPDATE
-- for authenticated (relacl: authenticated=dDxtm) -- 188 of its 202 columns are
-- granted individually, by the 20271005100000 baseline which computed its
-- allow-list from the LIVE catalog at that moment. `date_forced_by_lock_of` was
-- added later (20271106090000) and that migration contains **no GRANT at all**,
-- so the column got nothing. Its five siblings were granted before it existed.
--
-- ── WHY A PLAIN GRANT AND NOT A TRIGGER ────────────────────────────────────
-- Considered, and rejected as disproportionate. The deny-set's second condition
-- is "a concrete exploit exists for a forged value". This value only records
-- WHICH supplier's lock produced the date, and it decides only whose later exit
-- releases it (`releaseForcedDate`). A couple can therefore name a different
-- supplier **of their own event** and change which of their own suppliers can
-- release their own date. That is not an exploit; it is their event either way.
-- The columns that DO carry a trigger here (std_media_nsfw) gate a safety
-- verdict, which this does not.
--
-- Matches its five siblings exactly -- authenticated AND anon -- so the date
-- machinery is granted as one coherent set rather than five-of-six.
-- Idempotent: GRANT is repeatable.

GRANT UPDATE (date_forced_by_lock_of) ON public.events TO authenticated, anon;

-- Post-condition: prove the grant actually landed. A migration that "ran" and
-- left the privilege unchanged is the same silence this whole file is about.
DO $$
BEGIN
  IF NOT has_column_privilege('authenticated', 'public.events', 'date_forced_by_lock_of', 'UPDATE') THEN
    RAISE EXCEPTION
      'Migration 20271140727628 did not grant UPDATE on events.date_forced_by_lock_of to '
      'authenticated. Without it finalizeVendor''s six-column UPDATE is rejected 42501 in '
      'full and locking a supplier can never form the couple''s date.';
  END IF;
  IF NOT has_column_privilege('anon', 'public.events', 'date_forced_by_lock_of', 'UPDATE') THEN
    RAISE EXCEPTION
      'Migration 20271140727628 did not grant UPDATE on events.date_forced_by_lock_of to anon, '
      'so the date machinery is granted five-of-six and an anon-draft couple hits the same '
      'silent rejection.';
  END IF;
END $$;
