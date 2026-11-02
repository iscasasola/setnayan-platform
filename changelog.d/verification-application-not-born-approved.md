## 2026-08-12 · fix(vendor): a verification application cannot be born approved, and the applicant cannot write its decision

Seventh instance of the shape — and the **second time today the specific fault is
"the rule is enforced on one verb and not the other."** `20271132891176` was a
privilege guard attached `BEFORE UPDATE` only, so DELETE-then-INSERT walked past
it. Here the rule lives in RLS and the same half is missing:

```
..._owner_update_draft (FOR UPDATE)
  WITH CHECK (owns the vendor AND status IN ('draft','pending_review'))
..._owner_insert       (FOR INSERT)
  WITH CHECK (owns the vendor)          ← and nothing about status
```

The state machine is enforced when you **edit** an application and not when you
**create** one.

| | before | after |
|---|---|---|
| vendor inserts `status='approved'` | **ACCEPTED** | refused |
| vendor inserts `status='pending_review'` (skipping draft) | **ACCEPTED** | refused |
| vendor inserts `decision='approved', admin_user_id=<an admin>` | **ACCEPTED** | refused |
| vendor updates the decision on their own application | **ACCEPTED** | refused |
| vendor creates a draft, then submits it | worked | still works |
| admin decides via `/admin/verify` | worked | still works |

### Honest severity: this does not make anybody verified

The badge couples see comes from `vendor_profiles.verification_state` — a
different column on a different table, already blocked for end-user sessions by
`guard_vendor_profiles_entitlement` and further tightened by `20271134103060`. A
forged application grants nothing, and a behavioural test asserts exactly that,
so if it ever stops being true the severity is re-raised here rather than
assumed.

What a forged row actually does:

- **Never enters the review queue.** `/admin/verify` filters
  `.in('status', tabFilter.statuses)`, so an `approved` row sits under the
  Approved tab and no reviewer opens it.
- **Carries a decision record naming an admin who never made it.**
  `authenticated` held INSERT and UPDATE on *every* column of this table,
  including `decision`, `decision_reason`, `decided_at`, `admin_user_id`,
  `notes` and both `contact_*_confirmed_by/at` pairs.

Audit integrity rather than privilege escalation — on the table whose entire
purpose is recording who checked whom. Prod holds 1 application row.

### Two controls, chosen per column by what the app has to name

- **`status` keeps its grant.** The vendor legitimately writes it twice —
  `'draft'` at create, `'pending_review'` at submit — so a revoke would break the
  flow. The **policy** is the right control, and it now constrains both verbs.
- **The decision columns lose theirs.** No end-user path writes them at all, so
  the **grant** is the right control. The keep-list is computed from the catalog
  (precedent `20271005100000`), so a column added later is granted by default and
  only the named decision columns are withheld.

Same reasoning as `20271134103060`, where the grant had to *stay* because the app
named the column — the choice between policy and grant is decided by what the
legitimate code actually sends, not by which tool was used last time.

### ⚠ A pre-existing bug deliberately left alone

`withdrawApplication` (`vendor-dashboard/verify/actions.ts:466`) writes
`status='withdrawn'`, but the UPDATE policy's `WITH CHECK` admits only
`('draft','pending_review')`. **Withdrawing is already broken in production**,
before and after this migration. Not touched here: widening what a vendor may set
is a product decision, not a security fix, and folding it in would either
entrench the breakage in a test or widen a policy under cover of a security
change.

**Guards.** New `apps/web/tests/db/verification-application-not-born-approved.db.test.ts`
— 15 tests: anti-vacuity META (the INSERT policy pins `status='draft'`; the
UPDATE sibling still constrains, so a fix that "tidied" it would be caught;
`status` is deliberately still granted, so a future revoke tells whoever does it
that these tests stop probing the policy; real unprivileged probe role;
`service_role` keeps every decision column), behavioural coverage of all six rows
above **plus the honest-severity assertion**, and two NEUTRALISATION tests —
restore the unconstrained INSERT policy and the born-approved row lands again;
re-grant the decision columns and the forged record lands again.

`supabase/security/exposure-surface.baseline.txt` regenerated — this table only,
every line a narrowing. Verified that every prior fix's narrowing
(`chat_messages`, `coordinator_broadcasts`, `users`, `vendor_payment_methods`,
`papic_photos`, `editorial_vendor_media`) still reads narrow in the regenerated
file, so this cannot silently re-widen a sibling PR's guard.

SPEC IMPACT: None. The application state machine is unchanged; it is now enforced
on both verbs instead of one.
