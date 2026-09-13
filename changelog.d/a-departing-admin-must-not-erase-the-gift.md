## 2026-09-06 · fix(comp-grants): a departing admin no longer erases the gifts they issued

`comp_grants.granted_by` referenced `public.users` with **ON DELETE CASCADE**, so
deleting the admin who issued a comp deleted the grant row itself — retail value,
rationale, approver, the whole money record of what this company gave away. A
staff departure erased the receipts.

**The adjacent column is the proof it was a typo, not a decision.** `granted_by`
and `approved_by` are created in ONE statement, on consecutive lines, in
migration `20260515030000`: same table, same parent, opposite ON DELETE actions.
Nobody decides that the issuer's departure erases the record while the
approver's merely blanks a field.

**The rule was already written down and already tested — just not here.**
`erasure-completeness.db.test.ts` names this exact trap ("the over-deletion
trap") and states it verbatim: *delegate_user_id is CASCADE + NOT NULL (the row
is ABOUT them), granted_by/revoked_by are SET NULL (an actor stamp)*. Every other
actor stamp in the schema already obeyed it — `founder_seats.granted_by`,
`oauth_grants.granted_by_user_id`, `event_delegates.granted_by_user_id`, and
~30 `created_by*` columns. `comp_grants.granted_by` was the only one left, missed
rather than excused: the two sweeps that fixed the rest (`20271030238978`,
`20271032282809`) converted NO ACTION to SET NULL and never looked at CASCADE
columns, so it was never in their window. The new test's roll-call now asserts
that set is empty, so a future table cannot repeat it.

**⚠ A `SET NULL` alone would have been a worse bug, and the test suite could not
have told us.** `comp_grants.granted_by` is **NOT NULL in production** — and **no
migration in this repo sets it so**, so the PGlite replay produces it nullable
(`grep '^comp_grants\.' apps/web/tests/db/user-fk-behaviour.generated.txt`).
`ON DELETE SET NULL` on a NOT NULL column does not null anything: Postgres tries
`UPDATE … SET granted_by = NULL`, the constraint rejects it, and the whole
`DELETE FROM users` aborts with 23502. Without the `ALTER COLUMN granted_by DROP
NOT NULL` this migration also carries, the fix would have converted "the admin's
deletion erases the record" into "the admin cannot be deleted at all" — and every
local db test would still have passed, because the replay has no NOT NULL to trip
over. Verified against production with `pg_attribute.attnotnull`, twice, by two
different queries.

🔑 **Production and the migration set genuinely disagree about `comp_grants`
nullability** (`granted_by`, `user_id` and `rationale` are NOT NULL in prod and
nullable in the replay). Dropping the NOT NULL brings prod back to the
schema-as-code rather than weakening anything anyone designed. **The wider drift
is surfaced, not fixed here** — see the PR body; whether other tables carry
out-of-band constraints is an open question this change does not answer.

**Deliberately NOT copying the sibling fix.** `20271208142357` repairs
`comp_grants.event_id` by snapshotting the id into a no-FK column before nulling,
because a NULL `event_id` means "every event this user hosts" and plain SET NULL
would silently promote a one-event comp to account-wide. That reasoning does not
carry: an event is not a data subject, an admin is, and a `granted_by_snapshot`
would preserve a real person's uuid through the deletion of their own account —
exactly what the erasure test forbids. `granted_by` also confers nothing: neither
entitlement function reads it, and the only predicate that does is the RLS policy
`comp_grants_owner_read`, whose `granted_by = auth.uid()` branch is unreachable
once that account is gone.

`comp_grants.user_id` stays CASCADE on purpose: that row is the customer's
personal data under RA 10173.

`comp_grants` holds **0 rows in production**, so there is no backfill and no live
record at risk.

Guarded by `apps/web/tests/db/comp-grant-survives-its-granter.db.test.ts` (8
cases, including a roll-call over every actor stamp in the schema and a
non-vacuity check on it).

SPEC IMPACT: None. No price, SKU, or entitlement rule changes — a foreign key's
delete action and a nullability constraint, nothing a customer can see.
