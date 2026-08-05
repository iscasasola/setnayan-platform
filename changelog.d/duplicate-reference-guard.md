## 2026-08-05 · feat(payments): one bank reference can no longer be counted as money twice

Owner, 2026-08-05: *"must also detect if reference number is used twice."*
Nothing anywhere compared one reference against another — not the database, not
the forms, not the reconciliation screen.

**Two outcomes, because only one case is always wrong.**

- **SAME ORDER, same transfer → REFUSED, no override.** The shortfall guard adds
  up what payers CLAIM they sent, so two rows describing one ₱1,000 transfer
  reach ₱2,000 and promote an order that was half paid. There is no honest
  reading of this, so the acknowledgement box cannot unlock it.
- **DIFFERENT ORDER, same transfer → WARNS, naming the other order.** Possibly
  one lump sum covering two purchases, possibly the same receipt sent twice. A
  human with the bank app open decides.

🔑 **A BLUNT "ONE REFERENCE EVER" RULE WOULD BREAK REAL PAYMENTS.** Three
repeats are honest and still work:
1. **The re-send** — after "send me a clearer picture", the correction carries
   the SAME real reference. Only priors that already COUNT AS MONEY are
   considered, so a rejected row never warns. Warning there would fire on every
   honest fix and train the admin to click through warnings.
2. **One transfer, two orders** — allowed behind an explicit, unticked box.
3. **The BDO rail** — our code and theirs are never identical; ours ends with
   theirs. Matching is normalised (case, spaces, punctuation) and accepts
   containment in both directions, with a 6-character floor so short codes do
   not accuse each other.

The check runs BEFORE the row flips to matched — after it, the row is its own
duplicate. **Batch approval never acknowledges anything**: it is the one place
nobody is reading.

Two test files: the pure comparison (10 cases, no database) and a wiring guard
proving the rule is actually reached, the check precedes the flip, the
acknowledgement exists as a real unticked control, and batch cannot bypass it.
**Three mutations checked** — unlocking the same-order refusal, pre-ticking the
box, and letting batch acknowledge — each turns the suite red.

⚠ **NOT A DATABASE CONSTRAINT, DELIBERATELY.** A UNIQUE index on the reference
would block all three honest repeats above, and would miss the BDO shape
entirely since the strings differ.

SPEC IMPACT: None.
