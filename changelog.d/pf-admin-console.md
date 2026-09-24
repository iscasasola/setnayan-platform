## 2026-09-22 · fix(admin): a paid journal spotlight could be requested but never approved

W3 / register LAU-20.

`initiateSponsored` writes a pending `approve_journal_spotlight` row with
`target_id` (the spotlight) and no `target_user_id` — a spotlight is not a
person, the same non-user shape `approve_fraud_wipe_ban` already used. The
dispatcher in `app/admin/approvals/actions.ts` special-cased only the fraud type
before:

```ts
if (!row.target_user_id) throw new Error('Request has no target user');
```

so every other non-user type fell into that throw.

**The loop closed on itself.** The single-admin path refuses sponsored rows
deliberately and says *"Sponsored placements need two-admin approval — use the
sponsored queue."* That queue is `/admin/approvals`, which lists every pending
row (it filters on `status`, never on `action_type`) and calls this function,
which threw. So a paid placement could be requested, was listed, and could never
publish.

🔑 **It looked like nothing because only the LAST step failed.** Requesting
worked, the row appeared, the vocabulary was right, the CHECK was right, the page
was right. Nothing was wrong except that the dispatcher had no arm for a type the
rest of the system already created.

`every-approval-type-can-be-approved.test.ts` holds the general property, not the
instance: every `action_type` the app can CREATE has an arm in the dispatcher, so
a new type added without one fails in CI rather than when an admin presses
Approve. A second test pins ORDERING — an arm for a non-user target must sit
above the `target_user_id` throw, because below it the arm exists and is
unreachable.

Proved by sabotage: deleting the arm — restoring the original defect exactly —
turned both tests red (`2 created type(s), 1 with no dispatcher arm`); and
MOVING the arm below the throw, so it is present but can never run, turned the
ordering test red on its own. Restored, 2/2.

Measured while finding it: `approve_vendor_partnership` is in the type union, the
label map and the badge map in `lib/admin-approvals.ts` and is **never inserted
anywhere** — dead vocabulary, so it cannot throw. Left alone; retiring it is a
separate call.

SPEC IMPACT: None — restores a path the product already describes.

## 2026-09-22 · feat(admin): a comp is money, so it takes two admins

W3 / register LAU-19.

`admin_approval_requests` has enforced four eyes in the DATABASE since
2026-09-30 — `admin_approval_four_eyes`: `decided_by <> initiated_by` — and the
live vocabulary gated six actions:

    grant_internal_account · grant_team_pool · promote_to_admin
    approve_vendor_partnership · approve_fraud_wipe_ban · approve_journal_spotlight

**Every one is a PRIVILEGE. None is money.** A single admin could extend a
vendor's paid entitlement and write a `comp_grants` row carrying
`retail_value_centavos`, with nobody else involved.

🔑 **The intent was already in the schema, which is what makes this a defect
rather than a decision.** `comp_grants.approved_by` exists, and the grant path
set it to `null` on every row. The column was built for a second admin and never
given one.

Split on the `executeFraudWipeBan` precedent:

* `issueVendorSkuComp` — validates, refuses a duplicate pending request for the
  same vendor+SKU, and OPENS an approval. Grants nothing.
* `executeVendorSkuComp` — the whole grant, reachable only from the approvals
  dispatcher, after a different admin has confirmed. `granted_by` is the
  initiator, `approved_by` is the confirmer, and the audit row names both.

⚠ The entitlement expiry is computed at EXECUTION, not at request time. A comp
approved two days later must stack from the expiry as it is then; freezing the
date into the payload would silently shorten the grant.

⚠ **The CHECK vocabulary was re-listed from PRODUCTION, not from the migration
history.** `pg_get_constraintdef` on the live constraint lists the six above.
`approve_vendor_subscription` appears in a migration in this repo and is NOT in
the live CHECK — so re-listing from history would have added a value production
never had. A re-listed CHECK is only as good as where the list came from.

Measured before building: production holds **2 admins**, **0 comp grants ever**,
and **0 approval requests ever** — the mechanism had never been used. So the gate
blocks nothing today, and two admins make it usable.

Proved by sabotage, each verified to have landed: putting the `comp_grants`
insert back in the request path turned the first test red; setting `approved_by`
back to `null` turned the third red; and adding a second importer of the executor
turned the second red (`2 caller(s)`). The `approved_by` sabotage failed to apply
on the first attempt — the 4-space anchor is a SUBSTRING of the 6-space audit
line, so the count check saw 2 — and was retried with a newline-anchored match
rather than reported as a pass.

SPEC IMPACT: the first money action in the two-admin vocabulary. Refunds and
payout-account changes — the other two LAU-19 names — are NOT gated by this and
remain single-admin.
