## 2026-09-16 · feat(gift): a locked Setnayan gift cannot be switched off or resized (SUP-I)

⚖ Owner 2026-09-15, asked what should freeze when a couple locks: **both the promise
and the number.** ⚖ Owner 2026-09-16, asked WHICH of the two lock moments does it:
**"both. the supplier needs to pay us before this becomes true."**

So the promise is **recorded when the couple asks**, **confirmed when the supplier
agrees**, and immutable from then on — while delivery still waits for the money,
exactly as before. Nothing here grants a credit earlier.

**What was actually true, measured against the LIVE prod trigger body** (not the
migration file): `setnayan_gift_offered` (the yes/no) was already frozen at
charge-open, but `gift_credits` was **re-derived from the live catalogue on every
UPDATE** that left the row `pending`, freezing only at `paid`. So a couple could be
promised 1,429 photographs and granted a different number.

🔑 **AND AT THE LOCK THERE WAS NOTHING TO FREEZE ONTO.** The charge row that carries
the gift is not inserted until the supplier ACKNOWLEDGES the couple's deposit — two
steps and an **unbounded** gap after the promise was made (the only clock in the
chain is the 48h fuse on the ask). A freeze written into the charge trigger would
have frozen a value that did not exist when the couple was promised it. The promise
therefore lives on `event_vendors`, which exists from the ask.

**If the price moves between the two moments the couple keeps the better number**,
and the supplier's charge rides with the same winning stamp — the pair never splits.

**The basis is stored, not just the answer.** `setnayan_gift_fee_basis_centavos`
records the fee the 40% was taken of, mirroring `papic_limited_snapshots`. Auditable
down to the fee, not the ladder rung — stated rather than hidden.

⚠ **THE EXPOSURE SURFACE WIDENED BY SIX COLUMNS, AND THAT IS ARGUED, NOT WAIVED.**
`event_vendors` is granted at TABLE level, so the new columns inherit
`anon=SIU authenticated=SIU` and a column-level REVOKE against a table grant is a
**silent no-op** — narrowing is unavailable without restructuring the table's grants.
The baseline therefore records the widening and `guard_setnayan_gift_stamp` refuses
the write behaviourally: 42501 for a client role, `check_violation` for ANY caller
once confirmed. A db test proves a signed-in couple cannot forge themselves 50,000
photographs; without it the widening would be indefensible.

**Two bugs in my own work, caught by the tests rather than by review:**
- the stamp assigned `ROW(0, 0)` to a `RECORD` on the no-gift path — an anonymous
  record with no field names, so the next `v_gift.credits` raised 42703. It failed
  **only** on the branch where a card says NO, which nothing in production would
  have exercised for months.
- the fence test reported "no rejection" twice while proving nothing: first because
  `SET LOCAL ROLE` outside a transaction is a no-op, then because the replay's
  `auth.uid()` reads `request.jwt.claim.sub` and not the `claims` blob, so RLS hid
  the row and a **zero-row UPDATE raises nothing**. A non-vacuity precondition —
  assert the couple can SEE the row — is what caught both.

⚠ **This path has never executed in production.** Measured 2026-09-16: 48
`event_vendors` · 0 lock handshakes ever · 0 deposits recorded · 0 charges · 0
ledger rows · 0 cards with the gift on. The db tests are the only thing that has
ever run it; nothing here is "confirming known-good behaviour".

Sabotage-verified with occurrence counts printed before and after: the charge
ignoring the stamp goes red, and so does removing the confirmed-immutability guard.

Verified: 15,747 unit tests · typecheck clean · 19 db tests (incl. exposure-freeze
and the existing gift suite) · 7/7 on the new suite.

SPEC IMPACT: `DECISION_LOG.md` — the 2026-09-16 "both moments" ruling.
