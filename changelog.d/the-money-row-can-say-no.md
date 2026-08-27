## 2026-08-27 · feat(vendor): the money row on the Answers Desk can say no — and shows the receipt

Owner ruling 2026-08-27, asked directly and answered in one line: **_"yes. they can
declare it."_** — a supplier may declare that a downpayment a couple recorded never
reached them.

### 🔑 RULE 0 STOPPED A DUPLICATE BUILD MID-FLIGHT

I had written a 334-line migration — three new columns, a `decline_vendor_deposit`
RPC, a widened forgery trigger, a one-way CHECK, a new notification label — before
finding `vendorRejectDeposit` and the **`reject_vendor_deposit` RPC already in
production**: same ownership gate, same `FOR UPDATE` single-winner shape, an
optional reason that reaches the couple, and a working control on the supplier's
customer card. **All of it was deleted.** Two ways to say no is how they come to
disagree, and the guard now fails if a second one appears.

⇒ **The register's line "a payment claim has no 'no'" is FALSE as written.** What is
true is narrower and is what shipped here: **the DESK had no no.** It asked a money
question and offered one answer, with the other one screen away.

### What shipped

- **"It never arrived"** on the row, behind a fold with its own reason box —
  posting to the shipped action, never a new one. A no is a real answer the couple
  needs and must not be one mis-tap from the yes.
- 🧾 **The receipt, at last.** `proofUrl` had been fetched into that card since it
  was written and **never rendered once** — a supplier was asked to confirm a
  payment without being shown the proof of it. Now: *"See what they sent"*, or a
  plain line saying they attached nothing.
- 🗣 **The copy is a claim, not a fact.** It read *"Downpayment received"*, which
  states as settled the very thing the supplier is being asked to judge. It reads
  *"They say they have paid your downpayment"*, and the button is *"Yes, it
  arrived"*.
- **The answer is reported where it was given.** The action redirected to the
  customer card, so answering from the desk moved the supplier to another screen;
  it now returns to whichever surface they answered on, and the desk says what
  happened. 🔒 The posted value selects one of two known surfaces — it is never
  used as a path. **A refusal in silence is indistinguishable from one that never
  happened**, and this row VANISHES when answered, so all five RPC outcomes have
  words.

### 🪤 My own guard was decoration, again, and only the count showed it

The receipt assertion matched `card.proofUrl` **anywhere** — and the field is named
twice, in the branch and in the link. Gutting the branch to `{false ? (` left the
`href` standing: count **2 → 1** and the test **stayed green** with the receipt
gone. It pins three separate things now — the read, the branch, the link — and each
was re-sabotaged to RED. **7 mutations on this change, every one printed
before → after, all RED.** Second time in one day a mutation run caught one of my
own guards; assume a third.

### ✅ And the typecheck earned its keep

`href={card.proofUrl}` inside `{card.proofUrl ? (…)}` did **not** narrow — `string |
null` reached an attribute that takes `string | undefined`, and `tsc` said so. Fixed
with a local `const receiptUrl`, not a non-null assertion, which would have silenced
the one check that noticed. ⚠ The run before it was **exit 143 with an empty log**
on a machine at load average 40 — killed, not passed. Nothing was believed until a
run printed `TSC_EXIT=0` beside `ERROR_LINES=0`.

### ⏭ Named, NOT fixed — and one is a question for the owner

🔴 **A supplier's "no" WIPES THE COUPLE'S OWN RECORD OF PAYING.** The shipped RPC
clears `deposit_recorded_at`, the proof URL and the payment method, and **deletes
the couple's `event_vendor_payments` ledger row** (matched by a `notes LIKE
'%awaiting vendor confirmation%'` substring, unscoped by amount or date). So after
a refusal the couple's screen looks as though they never recorded anything, their
receipt is gone, and the only trace is the email. A supplier saying *"it did not
reach me"* is not evidence the couple did not send it. **Whether the couple keeps
their own record is the owner's call, so nothing here changes it.**

Also unchanged, deliberately: a confirmed deposit still cannot be un-confirmed (the
confirmation is what bills the booking fee and acquires the schedule pool), and a
refusal releases no date and cancels no booking.

SPEC IMPACT: `WHATS_NEXT_Vendor_Hub_And_Answers_2026-08-26.md` § 9 row 8 (built —
and its premise corrected) and § 7 (the owner question is answered). Applied in the
corpus.
