## 2026-08-28 · feat(payments): the reference number the buyer types is checked against their own screenshot

Owner, 2026-08-28: *"can we assign an AI to verify if that last 6 digits do exist
on the photo?"* and then *"if the reference code did not match, please type again
or upload a cleaner photo."*

A buyer sends two things on `/pay/[reference]`: a screenshot of their transfer
and the last six digits of the reference printed on it. Nothing compared them —
an admin opened the picture and did it by eye, on every payment. Now the picture
is read before the payment is accepted, so a typo is caught while the person who
can fix it is still on the screen, and what was read travels to the admin queue.

**The model transcribes; the shipped code decides.** The model is asked one
thing — "type out the words and numbers on this receipt" — and never whether
anything matches. The comparison is then done by `lib/payment-proof-scan.ts` and
`lib/payment-reference-match.ts`, which already existed, are pure, and carry
tests built from real GCash and BDO receipts. A model asked "does 884213 appear?"
can answer yes when it does not; a model asked to read aloud gives us text we
search deterministically.

**It approves nothing.** `payments.status` moves when an admin presses a button
and at no other time. `isDecisivePaymentMatch` — the predicate gating one-click
approval — does not import any of this, and `lib/an-ai-may-not-approve-money.test.ts`
fails if it starts to. (One-person admin plan, 2026-07-11: the machine may
prepare and may hold back, it may never be the thing that lets money through.)

**We ask once, then get out of the way.** Only a definite mismatch sends the
buyer back. Unreadable, not-a-receipt, no key, timed out, nothing typed, too
short to compare — all are "we do not know", and none of them asks. The second
submit is accepted whatever the picture says. A person who has already sent money
must always have a way through; they are the ones a stricter rule would trap.

Also fixed, found while answering the question: the reference field carried
`maxLength={6}`, so a buyer following the instruction beside it ("you can paste
the whole thing") had most of their reference **silently deleted by the browser**
before the server — which keeps 64 characters and says in terms that "six is a
minimum, not a maximum" — ever saw it.

- `supabase/migrations/20271176980266_an_ai_reads_the_payment_receipt.sql` —
  `payment_receipt_reads`, RLS on with no policy and no grant to anon or
  authenticated (the `admin_search_phrases` shape: nothing in a browser reads it).
  Verdict columns are nullable on purpose — a FALSE reads on screen as an
  accusation, so "we could not answer" must be storable as NULL.
- `apps/web/lib/payment-receipt-read.ts` — the prompt, the comparison and the
  sentence the admin reads. Pure.
- `apps/web/lib/payment-receipt-read.server.ts` — R2 fetch, normalise to JPEG,
  the model call, all bounded at 20s. Never throws.
- `apps/web/lib/r2.ts` — `r2GetBytes`, so a private bank receipt is read
  server-side without minting a 24-hour public URL for it.
- `apps/web/app/pay/[reference]/` — the pre-accept check, the ask, the field fix.
- `apps/web/app/admin/payments/` — the card above the approve button, and a
  "Read it again" button for rows that predate this.

⚠ **What it does NOT prove, stated in the product copy and never trimmed:** that
a reference is on the picture means the buyer copied their own receipt correctly.
It does not mean money arrived — only the bank's own message says that. A
screenshot is a picture and pictures are made in seconds; this is not a fraud
control and no copy calls it one.

## 2026-08-29 · docs(privacy): the disclosure the receipt reader was waiting for

The owner, as registered DPO, ruled on it directly — *"so add it. yes."* — and it
lands in this same PR rather than after it, because the disclosure and the code
that sends the data must never be able to ship apart.

Anthropic was already a declared subprocessor, so nothing was undeclared. What
was wrong is its declared ROLE: *"AI features, including AI web research for the
vendor Deep Search tool"* does not cover a bank screenshot, which carries an
account name and part of an account number. That is a new category of personal
data under RA 10173.

Widened in four places, not one — the public subprocessor entry, the cross-border
transfer sentence, the "what we collect" bullet, and the internal compliance
record — plus a new public section, **"Reading your payment receipt"**, modelled
on the Deep Search section: it names Anthropic, says out loud that a receipt is a
bank document instead of hiding it under "AI features", states the lawful basis
(contract, § 12(b)), and records what is kept.

The notice promises "Not the transcript", and that promise is now checked against
the INSERT payload rather than trusted: only the reference numbers and amounts
found, whether they matched, and one sentence for the reviewer.

New guard `lib/the-receipt-reader-is-disclosed.test.ts`. The existing
`subprocessor-drift.test.ts` cross-checks the two lists **by name**, which is why
it could not catch this: a company already on both lists can start receiving an
entirely new kind of data and that guard stays green. This one keys every
assertion on the seam that does the sending — delete the reader and the
obligation goes with it — and opens with a vacuity check so it can never pass on
nothing. Five mutations, each measured before → after, all red.

SPEC IMPACT: Applied. `DECISION_LOG.md` carries the 2026-08-29 DPO ruling row.
The public `/privacy` notice and `lib/subprocessors.ts` are updated in this PR;
nothing further is owed.
