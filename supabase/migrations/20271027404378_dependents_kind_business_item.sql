-- ============================================================================
-- 20271027404378_dependents_kind_business_item.sql
--
-- Widen `dependents.dependent_kind` so the four things the owner actually named
-- can be told apart (owner 2026-07-30: "these are only for their own account and
-- their dependents (children, business, items, pets)").
--
-- BEFORE: person | pet | other       — a business and a car were BOTH 'other'.
-- AFTER:  person | pet | business | item | other
--
-- Why it matters: 'other' collapsed two different things that celebrate two
-- different dates. A business has a founding date and an anniversary; an item
-- (a car, a home) has the day it became yours. Same column, different meaning —
-- and no way to say which. Splitting them is what lets the copy, the year view
-- and the create grid stop guessing.
--
-- ⚠ WIDEN, NEVER REPLACE. 'other' stays valid and stays in the vocabulary — it
-- is the honest catch-all, and app code branches on it. `person` and `pet` are
-- untouched. No existing value becomes invalid, so this cannot orphan a row.
--
-- WHAT DOES *NOT* CHANGE (deliberate):
--  • The age fence (<18 child / >50 elder / 18-50 blocked) stays PERSON-ONLY and
--    stays enforced app-side in lib/dependent-people.ts — a 12-year-old business
--    is not a minor and must never be run through a rule about minors.
--  • `birth_date_consent_at` stays PERSON-ONLY. A person's birthdate is
--    sensitive PI under RA 10173; a company's founding date and a car's purchase
--    date are not. Non-person kinds get NO consent stamp (see dependent-actions).
--  • No new table, view, function or column ⇒ no new object to REVOKE. (The
--    default-ACL trap — a new object in `public` shipping with anon's explicit
--    grant — cannot apply here: altering a CHECK creates nothing.)
--  • No policy, USING or WITH CHECK clause is touched ⇒ the exposure baseline is
--    unchanged.
--
-- Idempotent: DROP CONSTRAINT IF EXISTS + ADD, so re-running is safe. Ends with
-- a post-condition that RAISEs (aborting the transaction) if any row holds a
-- value outside the new vocabulary — a widening must never leave a row behind.
-- ============================================================================

BEGIN;

-- person | pet | business | item | other. Drop/recreate so the migration is
-- re-runnable; ADD CONSTRAINT validates every existing row on the way in, so a
-- row outside the new list would abort here rather than silently persist.
ALTER TABLE public.dependents DROP CONSTRAINT IF EXISTS dependents_kind_check;
ALTER TABLE public.dependents
  ADD CONSTRAINT dependents_kind_check
  CHECK (dependent_kind IN ('person', 'pet', 'business', 'item', 'other'));

-- Post-condition. ADD CONSTRAINT above already validates, but this states the
-- invariant in its own right and fails loudly (naming the offending values) if a
-- future edit ever recreates the constraint as NOT VALID.
DO $$
DECLARE
  bad_count  BIGINT;
  bad_values TEXT;
BEGIN
  SELECT COUNT(*), COALESCE(STRING_AGG(DISTINCT dependent_kind, ', '), '(null)')
    INTO bad_count, bad_values
    FROM public.dependents
   WHERE dependent_kind IS NULL
      OR dependent_kind NOT IN ('person', 'pet', 'business', 'item', 'other');

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'dependents.dependent_kind widening left % row(s) invalid (values: %). Aborting - a widening may never orphan a row.',
      bad_count, bad_values;
  END IF;
END $$;

COMMENT ON TABLE public.dependents IS
  'A generic "someone (or something) you care for" list (Phase 3 family graph, flag-gated). dependent_kind: person | pet | business | item | other. Sensitive PI (a child''s birthdate/religion/sex, guardian-consented) applies ONLY to kind=person under the app-side age fence — a conditional sub-case, not the table''s purpose. pet/business/item/other carry no sensitive data. Writes gated app-side behind dependentPeopleEnabled(); RLS Pattern A (owner-only).';

COMMENT ON COLUMN public.dependents.dependent_kind IS
  'person | pet | business | item | other. Only person records may carry birthdate/sex/religion + the age fence + milestones + the birth_date_consent_at stamp. birth_date holds the kind''s anchor date: a birthday (person/pet), a founding date (business), or the day it became yours (item).';

COMMIT;
