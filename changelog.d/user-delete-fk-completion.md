## 2026-08-02 · fix(db): finish the user-delete FK sweep — all 30 remaining blockers decided

Deleting a user was still refused by 30 foreign keys after PR #4019 swept 21, and
the reason the earlier sweep could not have finished the job is one line of schema:
`public.users.user_id -> auth.users(id)` is `ON DELETE CASCADE`, so deleting an auth
user **always** cascades into `public.users` and detonates every FK pointing there.
Twenty-six of the thirty pointed at `public.users`, not `auth.users` — and #4019's
guard test filters on `confrelid = 'auth.users'::regclass`, so it passed green while
the delete stayed broken. That filter is widened here; without it, new work in this
area would have been unprotected by the guard sitting right next to it.

Each of the thirty got one question: is the column the row's **actor** or its
**subject**? An actor column is an authorship stamp — who reviewed, granted,
uploaded, requested — and the row stays true when its author leaves, so it becomes
`SET NULL`, which is also the erasure-correct answer (the person stops being
identifiable, the record survives). Twenty-three are this. A subject column is the
row's reason for existing; keeping it after erasure means keeping a dossier on
somebody who asked to be forgotten, so it becomes `CASCADE`. Four are this: an abuse
flag *about* a person, a delegation *to* a person (a dangling access grant is a
security bug, not untidiness), a person's own time report, and a discount redemption
that already vanishes via its order.

Three keep refusing, and they are now the *only* lines in
`tests/db/user-delete-refusing-fks.baseline.txt` — which makes that file
self-documenting: everything in it is a decision, not an oversight. A refund, a
supplies purchase and an e-signature are records an anonymous actor would *falsify*
rather than de-identify (an unattributable payout is unauditable; under RA 8792 the
signer identity is the legally operative act). For those the answer is
anonymize-and-retain, which `lib/erasure/purge.ts` already does.

Thirteen of the `SET NULL` columns were `NOT NULL` and needed `DROP NOT NULL` in the
same migration. This is the trap worth naming: a `SET NULL` constraint on a `NOT NULL`
column does not fail when the migration runs — it fails at DELETE time, turning a
cleanly-refused delete into a runtime 500. It also genuinely retires the assertion
"this row always has an author", so read paths must render a null actor as something
like "removed user".

Two pieces of prod-vs-corpus drift surfaced and are fixed in passing.
`users.concierge_banned_by` has a foreign key in prod and **none** in the migration
corpus (the reconcile migration declared the column as a bare `UUID`), so the sweep
now *ensures* rather than merely converts: a listed column with no FK gets one. And
`concierge_abuse_flags` turned out to already declare exactly this actor/subject
split in its 2026 `CREATE TABLE` (`flagged_user_id … ON DELETE CASCADE`,
`reviewed_by … ON DELETE SET NULL`) while prod reads `NO ACTION` for both — so that
table is being restored to its declared design, not given a new opinion.

The valuable test is not "the catalog says SET NULL" — that is exactly what passed
while the bug was live. `user-delete-fk-surface.db.test.ts` now builds a user with
real dependents across both sides of the split, deletes them, and asserts the delete
succeeds, that actor rows survive with a null author, and that subject rows are gone.
Verified anti-vacuous: with the migration removed, four tests fail including that one.

Also: `describeUserDeleteBlocker()` turns the three deliberate refusals into a
sentence naming the record and the alternative, wired into the app's only real hard
delete (the abandoned-anon-draft sweep). An *un*recognised refusal deliberately keeps
the raw Postgres text — a foreign key nobody decided on is a regression and must not
be dressed up as a considered retention. Stale reasoning in `lib/erasure/purge.ts`
and `app/admin/users/actions.ts` (both cited the FK wall as the reason erasure never
deletes) is corrected to past tense, with a warning not to reintroduce a hard delete
now that the wall is down — the reason to anonymize is legal, not mechanical.

SPEC IMPACT: `DECISION_LOG.md` — record the actor-vs-subject rule for user-delete FK
behaviour, the three deliberate refusals with their legal bases, and the standing
consequence that 13 authorship columns are now nullable.
