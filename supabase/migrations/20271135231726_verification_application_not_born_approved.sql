-- ============================================================================
-- A VERIFICATION APPLICATION CANNOT BE BORN APPROVED, AND A VENDOR CANNOT
-- WRITE THE DECISION ON THEIR OWN APPLICATION.
-- ============================================================================
--
-- Seventh instance of the shape, and the SECOND time today the specific fault is
-- "the rule is enforced on one verb and not the other" — 20271132891176 was a
-- privilege guard attached BEFORE UPDATE only, so DELETE-then-INSERT walked past
-- it. Here the rule lives in RLS instead of a trigger, and the same half is
-- missing:
--
--   vendor_verification_applications_owner_update_draft  (FOR UPDATE)
--     WITH CHECK (owns the vendor AND status IN ('draft','pending_review'))
--     USING      (owns the vendor AND status = 'draft')
--
--   vendor_verification_applications_owner_insert        (FOR INSERT)
--     WITH CHECK (owns the vendor)          ← and NOTHING about status
--
-- So the state machine is enforced when you EDIT an application and not when you
-- CREATE one. A vendor could POST a brand-new row already `status='approved'`.
--
-- ── HONEST SEVERITY: THIS DOES NOT MAKE ANYBODY VERIFIED ──────────────────
-- The badge couples see comes from `vendor_profiles.verification_state`, which
-- is a different column on a different table and is already blocked for
-- end-user sessions by guard_vendor_profiles_entitlement. A forged application
-- grants nothing. What it does is:
--   • never enter the review queue — /admin/verify filters
--     `.in('status', tabFilter.statuses)`, so an 'approved' row sits under the
--     Approved tab and no reviewer ever opens it; and
--   • carry a FORGED DECISION RECORD. `authenticated` currently holds INSERT and
--     UPDATE on every column of this table, including `decision`,
--     `decision_reason`, `decided_at`, `admin_user_id`, `notes` and the
--     `contact_*_confirmed_by/at` pair. A vendor could write a row saying a
--     NAMED ADMIN approved them, on a date, with a reason.
--
-- That is an audit-integrity defect, not a privilege escalation, and it is worth
-- fixing on a table whose entire purpose is to be the record of who checked
-- whom. Prod holds 1 application row.
--
-- ── THE FIX ───────────────────────────────────────────────────────────────
-- 1. The INSERT policy gains the constraint its UPDATE sibling always had.
--    `'draft'` is both the column DEFAULT and the only value the app's own
--    insert supplies (vendor-dashboard/verify/actions.ts:112), so nothing
--    legitimate changes.
-- 2. The decision columns are revoked. `status` deliberately is NOT: the vendor
--    legitimately writes 'draft' at create and 'pending_review' at submit, so a
--    revoke would break the flow — the policy is the right control for that
--    column, the grant is the right control for the decision columns. Same
--    reasoning as 20271134103060, where the grant had to stay because the app
--    named the column.
--
-- The allow-list is COMPUTED from the catalog (precedent 20271005100000) rather
-- than typed, so a column added later is granted by default and only the named
-- decision columns are withheld — the failure mode of a hand-typed keep-list is
-- a legitimate field that silently stops saving.
--
-- ── ⚠ A PRE-EXISTING BUG DELIBERATELY LEFT ALONE ──────────────────────────
-- `withdrawApplication` (vendor-dashboard/verify/actions.ts:466) writes
-- `status='withdrawn'`, but the UPDATE policy's WITH CHECK admits only
-- ('draft','pending_review'). Withdrawing is therefore ALREADY broken in
-- production, before and after this migration. It is not touched here: widening
-- what a vendor may set is a product decision, not a security fix, and quietly
-- folding it into this file would either entrench the breakage in a test or
-- widen the policy under cover of a security change. Flagged in the PR instead.
--
-- Nothing about the admin path changes: /admin/verify decides through
-- createAdminClient() (service-role), which no policy or grant here affects.
-- ============================================================================

-- ── 1 · THE INSERT POLICY LEARNS WHAT THE UPDATE POLICY ALWAYS KNEW ────────
DROP POLICY IF EXISTS vendor_verification_applications_owner_insert
  ON public.vendor_verification_applications;

CREATE POLICY vendor_verification_applications_owner_insert
  ON public.vendor_verification_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
       WHERE vp.vendor_profile_id = vendor_verification_applications.vendor_profile_id
         AND vp.user_id = auth.uid()
    )
    -- An application starts life as a draft. Every other state is something the
    -- vendor SUBMITS into or an admin DECIDES into, and both of those are
    -- UPDATEs that the sibling policy already governs.
    AND status = 'draft'
  );

-- ── 2 · THE DECISION IS NOT THE APPLICANT'S TO WRITE ───────────────────────
DO $$
DECLARE
  cols text;
BEGIN
  REVOKE INSERT, UPDATE ON public.vendor_verification_applications FROM authenticated;
  REVOKE INSERT, UPDATE ON public.vendor_verification_applications FROM anon;

  SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum)
    INTO cols
    FROM pg_attribute a
   WHERE a.attrelid = 'public.vendor_verification_applications'::regclass
     AND a.attnum > 0
     AND NOT a.attisdropped
     AND a.attname NOT IN (
       -- Who decided, what they decided, when, and why.
       'admin_user_id', 'decision', 'decision_reason', 'decided_at',
       -- Internal reviewer notes.
       'notes',
       -- The admin's confirmation that the contact details are real.
       'contact_email_confirmed_at', 'contact_email_confirmed_by',
       'contact_phone_confirmed_at', 'contact_phone_confirmed_by'
     );

  -- anon gets nothing back: every policy on this table is TO authenticated.
  EXECUTE format(
    'GRANT INSERT (%s) ON public.vendor_verification_applications TO authenticated', cols);
  EXECUTE format(
    'GRANT UPDATE (%s) ON public.vendor_verification_applications TO authenticated', cols);
END $$;

COMMENT ON COLUMN public.vendor_verification_applications.decision IS
  'The admin''s ruling. Written only by /admin/verify through the service-role '
  'client; authenticated/anon hold no INSERT or UPDATE privilege on it, nor on '
  'decided_at, decision_reason or admin_user_id — otherwise an applicant could '
  'write a record saying a named admin approved them. Migration 20271135231726.';

COMMENT ON COLUMN public.vendor_verification_applications.status IS
  'Application state machine. Deliberately still writable by the vendor — they '
  'set ''draft'' at create and ''pending_review'' at submit — so the POLICY, not '
  'the grant, is what constrains it: owner_insert admits only ''draft'', '
  'owner_update_draft admits only ''draft''/''pending_review''. Before '
  '20271135231726 the INSERT policy constrained nothing and a vendor could '
  'create a row already ''approved''.';
