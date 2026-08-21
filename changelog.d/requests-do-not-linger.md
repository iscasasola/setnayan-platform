## 2026-08-21 · fix(privacy): requests really do stop lingering — and "both must have an account" becomes the rule, not a pilot

### The promise that had nothing behind it

The live public privacy notice has said this since the connection tree shipped:

> **Requests do not linger.** A request nobody answers, and a connection that is
> declined, are both deleted after 30 days.

**Nothing deleted them.** No `DELETE FROM public.person_connections` existed in
any migration, and no sweep existed in the application. Production holds zero
connections, so nobody was stranded — but under RA 10173 storage limitation we
are bound by the period we **declare**, which makes that sentence the obligation
rather than an aspiration. Same family as the retention-copy trap this repo
already guards against; this is that trap in the one place the guard did not
look.

`expire_stale_connection_requests()` (migration `20271155852254`) now deletes:

* `pending` older than 30 days by `created_at` — nobody answered;
* `declined` older than 30 days by `declined_at` — answered, and it is over;
* `draft` older than 30 days — never sent to anybody, and a private note nobody
  has touched in a month is not a record worth keeping.

⛔ **Never `confirmed`.** That is a relationship both people agreed to; it has no
expiry, and deleting one would be data loss dressed as hygiene. ⛔ Never a row
somebody already removed — those are gone from every read, and re-deleting them
would only inflate the number the job reports.

It is a **hard** delete: the notice says *deleted*, and a soft-deleted row still
holds a relationship claim about two named people.

Cron-free like every other periodic job here — one visitor's request per day
does the work, claim-gated in `daily-email-jobs.ts`. **And `/privacy` now renders
the constant the sweep deletes by**, so the copy and the code cannot drift.

### 🚨 A guard of mine proved nothing, and the mutation is what said so

The test asserting *"no browser role may run a retention sweep"* stayed **green**
when the `REVOKE … FROM authenticated` line was deleted. The PGlite replay never
granted EXECUTE in the first place, so revoking it changes nothing there.

**In production it changes everything**: Supabase's default privileges GRANT
EXECUTE to `anon` and `authenticated` on every new function in `public` — the
exact fact the `resolve_or_claim_person` lockdown was written to fix on
2026-07-31, where a REVOKE FROM PUBLIC alone left `anon` executing. So the
privilege check passes for a reason unrelated to the guard, and the guard is now
also asserted where it can actually be proven: the migration text. Re-measured
after the fix — deleting the same line turns it **red**.

### ⚖ And a ruling recorded where a reader will find it

Owner, asked directly whether somebody must hold an account to appear on a
People list: *"these people must have an account to be listed as people."*

`kin_pilot_mutual_accounts` already enforced exactly that — but its own migration
called itself a pilot boundary and said *"for a pilot that is the right trade;
for the full product it is probably not"*, inviting a future session to drop the
trigger. That is now **superseded**. Applied migrations are never edited, so the
correction goes on the object's `COMMENT`, which is what a reader queries: *do
not drop this trigger.* Somebody without an account is added as an **alaga** (a
profile you hold, with its own consent stamps) or invited to **join** — never
recorded as a connection.

That also closes the one open item from the approved mock: the *"Only you can see
this"* row, for writing down a person who is not on Setnayan, is **retired by
owner ruling** rather than pending.

Tests: 12 db (`requests-do-not-linger`), mutation-measured both ways — sweeping
`confirmed` too turns 2 red; deleting the authenticated revoke turns the source
guard red (and left the privilege guard green, which is the finding above).

SPEC IMPACT: `DECISION_LOG.md` — both parties must hold an account, permanently;
and the 30-day expiry is now enforced rather than only printed.
