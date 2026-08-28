## 2026-08-28 · feat(events): the removal panel says WHICH money, and gives a door

Owner 2026-08-28, looking at the shipped refusal: ***"still failed to
identify"***. And: *"Request for deletion … they can pick a reason for deleting.
or they state their reason."*

**What a person gets.** Pressing *Remove for good* on a celebration money is
holding no longer shows one sentence and a Cancel button. It now says which
money, names what was bought with the amounts, and offers **Ask us to remove
it** — a reason and a note that reach a person. Every ordinary removal is also
asked why, in one tap, on the way out.

🔴 **AND THE OLD SENTENCE WAS NOT TRUE ON THE ONLY CELEBRATION IT HAS EVER BEEN
SHOWN FOR.** Read out of production, not guessed: *Start of Life* carries one
bill for **₱2,899** (Papic — 6,000 shots · Setnayan AI), status `submitted`; one
GCash payment, status `pending`, sent four minutes later with a screenshot; and
**no receipt**. Nothing had been confirmed. The panel said *"already been paid
for"*. Four different situations wore that sentence — money we confirmed, a
payment nobody has opened, a supplier, and a check that failed — which is
exactly what "failed to identify" meant.

🪤 **AND THERE WAS A TRAP UNDERNEATH IT.** A couple can already cancel their own
unpaid bill from the bill's own screen, and it would *not* have unblocked the
removal — the payment they sent stays on file. They would have cancelled, come
back, and been refused again with no explanation.

🔑 **THIS IS NOT A NEW MECHANISM.** `account_deletion_requests` (20261106000000)
already does this exact shape for closing an ACCOUNT: filed by the person with a
reason, one open at a time, withdrawable, answered by an admin. This is that
pattern pointed at one celebration.

⚖ **A PERSON ANSWERS EACH ONE, rather than the couple pressing through.** The
alternative on the table was "removing this voids what you paid for, no refund".
That is a promise about money printed next to services carrying a BIR official
receipt, and it can be made at 1 a.m. with nobody in the loop. Production has
held exactly one bill, ever, so a human answering costs nothing today and keeps
the money decision with a person until there is enough of it to write a rule
from. The screen says *"we can't put the money back automatically"*, which stays
true whichever way that rule eventually goes.

⛔ **TWO BLOCKS KEEP THEIR DEAD END ON PURPOSE.** A supplier block already has a
better door — it asks the suppliers, rather than putting us in the middle of
somebody else's money. And an unreadable check gets no button at all: there is
nothing to request about, because we do not yet know whether there is anything
to request about.

🪤 **THE `authenticated` REVOKE IS LOAD-BEARING AND THE FIRST CUT DID NOT HAVE
IT.** Measured by dry-running the migration against production inside a
rolled-back transaction: revoking from PUBLIC and `anon` left `authenticated`
holding **all seven** privileges, and the following `GRANT SELECT, INSERT,
UPDATE` added nothing it did not already have. **A GRANT is not a narrowing;
only a REVOKE is.** Re-measured after the fix: `anon` 0, `authenticated`
exactly `INSERT,SELECT,UPDATE`, 5 policies, the insert works, and
`to_regclass` confirms nothing was left behind in production.

🔒 **`event_id` CARRIES NO FOREIGN KEY, DELIBERATELY.** The reason for an
ordinary removal is written moments *before* the celebration is deleted — a
cascade would take the answer with it, and SET NULL would leave a reason
attached to nothing. `event_name` is snapshotted for the same reason. Stated in
the table's own COMMENT so a future reader treats it as a label, never a join
key that will resolve.

🚨 **A NOTIFICATION TYPE THE DATABASE NEVER HAD IS REFUSED, NOT THROWN.** Three
have shipped in this repo already. `event_deletion_answered` is added to the
Postgres enum in the same change as the code that emits it, plus its union
member, label, colour and the transactional-email allowlist.

🚨 **AND THE ADMIN REMOVAL WAS LEAVING THE PHOTOGRAPHS BEHIND.** `/admin/events`
deleted the rows and never swept R2 — so an admin removal left the files in
storage, unreachable because the rows naming them were gone, while the couple's
own confirmation says *"your photos and everything about this celebration are
deleted for good"*. Fixed here: collected before the DELETE, swept after, on
both admin paths. *A promise made on one screen is not kept by whichever path
happens to run.*

🛡 `lib/event-deletion-reasons.test.ts` — 14 assertions, every one
mutation-checked with the occurrence count printed before → after, all RED:
`blockKind(` gutted 1→0 · the awaiting-check sentence reverted 1→0 · the
payments query flipped off `matched` 1→0 · `self_removed` renamed 1→0 · one
`<ReasonPicker>` deleted 2→1 · Remove made to wait on the reason 1→0 · the admin
sweep removed 1→0 · the email allowlist entry renamed 1→0 · `event_id` given a
cascading FK 1→0 · the `authenticated` revoke deleted 1→0 · a policy's `TO`
clause dropped 2→1 · the enum value not added 1→0.

🪤 **AND TWO OF THOSE ASSERTIONS WERE DECORATION UNTIL THE MUTATIONS CAUGHT
THEM.** One matched a bare `.eq('status', 'pending')` — which the read of the
couple's own open REQUEST also satisfies, three functions away — so flipping the
payments query to `matched` left it green with the whole distinction gone. The
other counted the substring `<ReasonPicker`, which `<ReasonPickerX` still
contains, so a rename-style mutation moved the count 2→2 and reported a pass.
Both re-anchored. A third counted the migration's own prose warning about
`CREATE POLICY` as a sixth policy.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-28.
