## 2026-09-22 · fix(chat): a closed conversation says who closed it

Owner, 2026-09-22: **"fix the withdrew and booked-another copy."**

Both thread pages ended their branch chain in a bare `else`, so **every** non-`accepted`,
non-`pending` state rendered one sentence. The result was an app stating a fact about the other
party that was not true:

- a couple who **withdrew their own inquiry** was told *"{vendor} isn't available for your date"*
  and offered **See similar vendors**, as though they had been turned down;
- a supplier whose customer **booked someone else** was told *"You declined this inquiry"* — an act
  they did not perform.

🔑 **A blank invites a question; a false sentence closes one.** Same family as a refused read
rendering as "No guests yet".

**The measurement that changed the shape of the fix.** A withdrawal is **not**
`inquiry_status = 'withdrawn'`. `withdrawInquiry` writes `.update({ archived_at: … })` and never
touches the status, so a withdrawn thread keeps the status it had and is **invisible to a status
read**. The closing state is a function of two columns. The couple's LIST page already knew this
(`isRemoved = archived_at != null` → the "Removed" badge) while the THREAD page never read the
column — **the list was right and the thread was wrong**, which is why the rule now lives in one
module both sides import rather than being fixed twice.

**New:** `apps/web/lib/thread-closing-copy.ts` — a pure decision module (`resolveClosingKind`,
`closingCopy`), no imports, no React. Executed by `apps/web/lib/thread-closing-copy.test.ts`
(8 tests). Both thread pages now render `closing.sentence` and gate **See similar vendors** and
**Withdraw inquiry** on `closing.showSimilarVendors` / `closing.showWithdraw`, so alternatives are
offered only where the couple was actually turned down.

⛔ **The defect was the catch-all, not the two sentences.** Any label added to the enum later would
have silently inherited "declined". An unrecognised status now resolves to an explicit
`'unrecognised'` kind with neutral words and no alternatives. It deliberately does **not** throw: a
server component that throws takes the whole conversation down, and a couple losing their thread is
worse than a vague sentence.

⛔ **`'withdrawn'` and `'expired'` are in the enum and nothing writes them.** Measured in production
2026-09-22: zero rows for every non-`accepted` state, and neither label appears anywhere in
`apps/web/app` or `apps/web/lib` for a chat thread. The vocabulary is enforced by the **enum type,
not a CHECK constraint** — so grepping the migrations for a state list finds nothing, and that
nothing means nothing. **A state in the enum is not a state the product can reach.**

**A second guard, because the first could not see its own argument.** The mapping test executes the
module but cannot prove the pages *reach* it correctly. Measured: with both pages edited to pass
`{ inquiry_status: thread.inquiry_status }` — dropping the one column a withdrawal is stored in —
**all eight mapping tests stayed green** and every withdrawal would have read as a decline again.
TypeScript cannot catch it either, because `ChatThreadRow.archived_at` is optional and a literal
that omits an optional property type-checks. So `closingCopy` now takes the **row**, and
`apps/web/lib/the-closing-copy-gets-the-whole-row.test.ts` asserts structurally that every call site
passes the bare `thread` — scanning every occurrence, not just the first. Watched red against that
exact sabotage while the mapping tests stayed green, which is the entire reason it exists.

Sabotages watched red before commit: (1) point `withdrawn` at the decline copy → *withdrew ≠
declined* fails; (2) restore the bare `else` so unknown falls through to `declined` → *an
unrecognised state borrows nobody's words* fails; (3) drop the `archived_at` check → *a withdrawal
is stored as archived_at* fails. The runner was first probed with a deliberately failing assertion,
so a green run is known to mean something.

⚠ **One visual delta, stated rather than hidden:** the decline sentence previously bolded the word
*"Why:"* via a `<span className="font-semibold">`. The wording is byte-identical, but it now renders
as plain text, because the module owns the sentence and returns a string. Reinstating the bold would
mean the wording living in two places again.

✅ **The new wording is APPROVED.** The withdrawn and displaced sentences on both sides were this
session's invention, flagged as such and put to the owner as words rather than written in as a
decision. Owner, verbatim: ***"the sentences are fine, keep them."*** The nouns already came from his
shipped list badges ("Removed", "You booked another", "Released · booked another"); the sentences are
now his too.

SPEC IMPACT: **APPLIED.** `DECISION_LOG.md` row added (corpus commit `7950e5d`) recording the
approved sentences verbatim, the mechanism — a withdrawal is `archived_at` and never a status, so a
copy-only fix could not have worked — that `'withdrawn'`/`'expired'` are dead enum labels enforced
by the type rather than a CHECK, the accepted loss of the bold *"Why:"*, and the one item still open
(a withdrawn-but-`pending` thread still rendering *"Waiting for {vendor} to accept"*). Iteration
`0019_communications` does not specify closing copy, so no iteration edit and **no pandoc regen is
owed** — checked rather than assumed.

## 2026-09-23 · fix(chat): a withdrawn conversation offers nothing

Owner, 2026-09-23: **"fix the withdrawn wording now since you're free."** He reversed his own
"later" after the deferral's only reason — nobody has ever withdrawn an inquiry, so nobody has
seen it — stopped applying.

⚠ **It was not a wording fix.** `withdrawInquiry` writes only `archived_at`, so a withdrawn thread
is still `inquiry_status = 'pending'` and both pages reached their PENDING arm on a conversation
the couple had already closed:

- the couple kept a **working composer** (`pending && canFollowUpWhilePending`), or was shown
  *"Waiting for {vendor} to accept"* with a **Withdraw inquiry** button for an inquiry already
  withdrawn;
- the supplier was shown **Accept inquiry**.

🔴 **And the accept would have succeeded.** `acceptInquiry` never reads `archived_at`; it goes
straight to `.update({ inquiry_status: 'accepted' })`. `sendChatMessage` does not read it either.
**The wording was the symptom; the screens were offering the wrong acts.**

`isThreadClosed()` joins `lib/thread-closing-copy.ts` and is asked **before** the status on both
pages — the couple's `composerOpen` and pending arm, the supplier's pending **and accepted** arms
(a couple may withdraw after accepting). New guard
`apps/web/lib/a-withdrawn-thread-offers-nothing.test.ts` executes the rule **and** pins the gating
in both pages, scanning every `pending ?` occurrence rather than the first, and asserting neither
page re-derives "closed" from `archived_at` itself.

Sabotages watched red: couple composer drops the check · couple pending arm drops it · supplier
pending arm drops it · `isThreadClosed` always false. Runner probed with a failing assertion first.
`tsc` exit 0 — and because that run was 12s (incremental), an injected type error was used to prove
the fast path still goes red in this worktree: `exit=2 · 1 error`.

⛔ **NOT DONE, NEEDS AN OWNER:** the server still permits it. `acceptInquiry` and `sendChatMessage`
accept a withdrawn thread, against this repo's own standard for the sibling case (*"a stale page
pressing Lock anyway is refused with nothing written"*). A UI gate leaves an already-open page able
to accept a withdrawn inquiry. Untouched because `lib/chat-actions.ts` is shared and a server
refusal is a behaviour change whose blast radius — the auto-reply bot, `'system'` senders — was not
traced. Zero withdrawals exist in production, so nothing is at risk today.

SPEC IMPACT: None beyond the row already added for the closing copy (corpus `7950e5d`), which named
this as the open item.
