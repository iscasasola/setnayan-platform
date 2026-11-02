## 2026-08-27 · fix(vendor): a supplier's "it never arrived" marks the claim — it no longer deletes the couple's record of paying

Owner ruling 2026-08-27, asked in plain terms and answered in plain terms:
**"yes they keep their record."**

### 🔴 What it was

`reject_vendor_deposit` cleared `deposit_recorded_at`, `deposit_proof_url` and both
method columns **and deleted the couple's `event_vendor_payments` row** — matched on
`notes LIKE '%awaiting vendor confirmation%'`, a substring, unscoped by amount or
date. So the other party to a money disagreement could erase the couple's only
record of their side of it: after a refusal their screen fell back to *"Paid a
deposit off-platform? Record it"*, reading as though they had never paid anything,
with no amount, no receipt and no ledger line. The only trace anywhere was an email.

**A supplier not seeing the money is not evidence the couple did not send it.** A
transfer can take days, a reference can be mistyped, a name can mismatch.

### What it is now

The refusal is a **mark**: `deposit_declined_at` + the supplier's own words + who
said it. Everything the couple entered stays exactly where it was, and both sides
keep what they said — the only honest shape for a disagreement about money that
never touched us. Same RPC name, same arguments, same four statuses, so every
caller is untouched.

* The couple's card **says** their supplier refused, quotes their words, keeps the
  amount and the receipt on screen, and offers **"Send it again"**.
* 🪤 **That button is the whole reachability of the feature.** It rendered on
  `!recorded && !open`, which worked ONLY because the refusal deleted the record —
  keeping the record without widening that condition would have left the couple
  told their payment was refused and given no way to answer. *A fix nobody can
  reach is no fix*, and the guard pins the exact condition.
* Re-sending **clears the refusal** — the database cannot infer it, because
  `recordDeposit` COALESCEs the claim timestamp, so a re-send changes no marker a
  trigger could watch. It is its own statement AFTER the write that must not fail.
* The supplier's card **reports their answer** instead of asking again, and keeps
  **"It arrived after all"** — the confirmation clears the refusal, which is how a
  late payment gets back in.
* An answered claim **leaves the Answers Desk** (feed and open-task list both),
  exactly as a confirmed one does.
* 🔒 The forgery guard now covers the refusal: a couple may **clear** it (that is
  re-sending), never **set** one. The ninth "the row is yours, the field is not".
* A `CHECK` makes confirmed-and-refused unrepresentable, and the confirmation
  clears the refusal so it stays satisfiable without a second call.

### 🚨 The downstream effect that would have bitten

**A refused claim must not hold the couple's delete.** `supplierWasPaid` counts a
recorded deposit and a ledger row as *paid*, and a paid, unreleased supplier blocks
the couple deleting their own celebration until they agree. Those are precisely the
two facts the old refusal deleted — so keeping them would have left a couple's
celebration **permanently undeletable behind a supplier who says they were never
paid for it**. The refusal now suppresses exactly those two signals and nothing
else, which makes the gate behave, after a refusal, byte-identically to the way it
behaved when the refusal wiped them. The equivalence is asserted, not asserted-of.

### 🔒 The exposure guard fired, and the diff was read rather than regenerated away

Three new capabilities, `anon=SIU authenticated=SIU` — **counted, and byte-identical
in shape to their two nearest siblings** (`deposit_acknowledged_at` and
`lock_answered_by_user_id`: the same kind of field, the same table, the same
trigger protection). `authenticated` genuinely needs SELECT (the couple reads the
refusal) and UPDATE (clearing it *is* re-sending). **`anon` reaches ZERO rows** —
that table has four policies and none names `anon` or PUBLIC, measured in
production.

🪤 **And a column-level REVOKE here would be INERT:** the grants are TABLE-level,
and Postgres ignores a column REVOKE while the table privilege stands — the same
trap that once shipped a `REVOKE UPDATE (cols)` protecting nothing. Narrowing these
three means revoking at table level and re-granting a 73-column allowlist, which is
how `events` is built and why it needs its own lint. **Named as debt in the
migration header, not attempted here.**

The FK map is regenerated too: one line, `SET NULL nullable` — erasing the account
that said it must not delete the booking.

### Verification

- `tsc` errors=0 **EXIT=0** · new db suite **5/5** · new unit guard **5/5** · gate
  suite **21/21** · whole db suite green.
- **16 mutations, occurrence count printed before → after, all RED** — 7 against
  the migration (the erasure returns · the ledger delete returns · the confirmation
  stops clearing · the ownership gate removed · the CHECK dropped · the guard stops
  covering the refusal · **the couple can no longer clear it**) and 9 against the
  app.
- 🪤 **A THIRD DECORATIVE GUARD, caught by mutation not review:** the assertion for
  the supplier's words matched the PROP NAME anywhere, and it is named three times
  (type, destructure, render) — gutting the render left two behind and the test
  stayed green with the words gone. Now pinned on the rendered block. *Assume a
  fourth.*
- 🔑 The db test asserts the CLEAR **succeeds** as well as the SET failing: if RLS
  simply denied the couple that row, the refusal would be permanently unanswerable
  and the guard would still pass. *An RLS denial and an empty result are the same
  value.*
- Read out of production before writing: both function bodies, the trigger, the
  grants (73/73 columns), and 0 deposit rows ever — so nothing is mid-flight.

SPEC IMPACT: `WHATS_NEXT_Vendor_Hub_And_Answers_2026-08-26.md` § 9 row 8 and § 7
(the open owner question is answered). Applied in the corpus.
