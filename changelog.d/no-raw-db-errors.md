## 2026-08-15 · fix(create-event): the database stops speaking to the customer

Third fix from the *"how do we make creating an event effective?"* audit (owner,
2026-08-15).

🔴 **A COUPLE ON A WEDDING-PLANNING SITE WAS SHOWN POSTGRES PROSE.** Any refusal the
product had not specifically anticipated was printed to the person exactly as the
database wrote it — English about rows violating check constraints, or a duplicate key,
in a red box. Nothing in it was actionable; it read as a broken product rather than a
rule they could satisfy.

**Both halves had to be wrong for it to happen, and both were:** the server action
redirected with `?error=<the raw DB message>`, and the page rendered
`ERROR_COPY[code] ?? code` — falling back to printing the code, which *was* the message.

🔑 **AND A QUERY STRING IS NOT A PRIVATE CHANNEL.** The raw message travelled through
the URL — browser history, the referrer of anything the page loads, any analytics that
records URLs. Constraint names, column names, sometimes values. It now goes to the
server log, where we can read it and the customer cannot.

🚨 **A SECOND, WORSE BUG FOUND WHILE FIXING THE FIRST — AND THE OLD ADVICE WAS THE ONE
THING THAT MUST NOT BE FOLLOWED.** On a failed owner-link the event row **already
exists**; only the link naming its organiser failed. The event is then owned by nobody
and unreachable (the dashboard admits members; there are none). Telling that person
*"please try again"* **mints a second orphan.** All three sites now roll the event back
so retrying is genuinely safe — and if the rollback itself fails, a **different** code
carries a different, truthful sentence instead of advising a duplicate.
*A forward step that cannot be undone is half a step.*

Sites fixed: `create-event/actions.ts` (insert · member link · plan-next-year insert ·
plan-next-year member link) and `onboarding/simple/actions.ts` (insert · member link),
plus the two render fallbacks.

⚠ **SCOPE, DELIBERATE:** the `/admin/*` actions still redirect with real messages and
are **left alone** — an operator debugging a queue is the one audience for whom the
database's own sentence is the useful answer. ~18 such sites; named, not forgotten.

🛡 **New guard `no-raw-db-errors.test.ts` holds BOTH halves and the family** — fixing
only the actions leaves the render fallback armed for the next author; fixing only the
render leaves the leak in the URL.

🪤 **AND ITS FIRST CUT CRIED WOLF ON CORRECT CODE — the second time today.** It scoped
a failure branch to a fixed **900-character window**. `stripComments` blanks a comment
**in place** (it substitutes spaces to preserve offsets), so the explanatory docblock
*inside* the branch ate ~600 of those characters and pushed the asserted string to index
1150. The fix was right; the guard was measuring a window instead of a block. Replaced
with real brace matching. 🔑 **Never slice source by a character count** — both of
today's false alarms came from guessing at text boundaries instead of parsing structure.

🔬 **Three mutations, counts printed before → after, restored 7/7 green each time:**
M1 leak the raw message back into the URL (2→1) → red · M2 page falls back to the raw
code (1→0) → red · M3 delete the rollback (1→0) → red on exactly the rollback test.

SPEC IMPACT: None. Error copy and failure handling on existing paths; no price, SKU,
schema or flag change.
