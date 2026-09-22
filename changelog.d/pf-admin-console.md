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
