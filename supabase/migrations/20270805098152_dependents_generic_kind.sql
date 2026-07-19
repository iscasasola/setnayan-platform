-- ============================================================================
-- 20270805098152_dependents_generic_kind.sql
--
-- Make DEPENDENTS generic (owner 2026-07-13: "a dependent can be a dog, a cat,
-- or anyone — there is no specification that it needs to be a child").
--
-- Adds `dependent_kind` (person | pet | other). This reframes the table from a
-- "guardian-held CHILD record" into a general "someone (or something) you care
-- for" list:
--   • kind = 'person' → the human case. The app-side age fence (<18 / >50),
--     debut milestones, hand-over-at-majority, religion/sex and guardian-consent
--     stamps apply ONLY here. Sensitive PI (a child's birthdate/religion) is
--     therefore a CONDITIONAL sub-case of this table, not its defining purpose.
--   • kind = 'pet' | 'other' → no age fence, no debut, no religion — just a name
--     and (optionally) a birthday to celebrate. No sensitive personal data.
--
-- The table is still gated app-side by `dependentPeopleEnabled()`
-- (NEXT_PUBLIC_DEPENDENT_PEOPLE) and RLS Pattern A (owner-only). It is EMPTY in
-- production, so backfilling the default 'person' on existing rows is a no-op.
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.dependents
  ADD COLUMN IF NOT EXISTS dependent_kind TEXT NOT NULL DEFAULT 'person';

-- person | pet | other. Drop/recreate so the migration is re-runnable.
ALTER TABLE public.dependents DROP CONSTRAINT IF EXISTS dependents_kind_check;
ALTER TABLE public.dependents
  ADD CONSTRAINT dependents_kind_check
  CHECK (dependent_kind IN ('person', 'pet', 'other'));

COMMENT ON TABLE public.dependents IS
  'A generic "someone (or something) you care for" list (Phase 3 family graph, flag-gated). dependent_kind: person | pet | other. Sensitive PI (a child''s birthdate/religion/sex, guardian-consented) applies ONLY to kind=person under the app-side age fence — a conditional sub-case, not the table''s purpose. pet/other carry no sensitive data. Writes gated app-side behind dependentPeopleEnabled(); RLS Pattern A (owner-only).';

COMMENT ON COLUMN public.dependents.dependent_kind IS
  'person | pet | other. Only person records may carry birthdate/sex/religion + the age fence + milestones.';

COMMIT;
