## 2026-08-31 · fix(papic): donated credits stop earning a per-guest ceiling exemption

Found by rebasing onto `main` after PR #5034 merged and **probing the two features
together**. Neither is wrong alone, and both suites were green.

Measured on the replayed schema — her camera holding her own 137, a 200 hand-out from
the couple, 41 already shot:

| | before | after |
|---|---|---|
| she could give back | **137** (incl. the 41 already shot) | **96** (her unspent own credits) |
| her ceiling exemption after donating, once she shoots on the hand-out | **137** | **41** |

She was exempted from the couple's limit for credits she had **given away**, while
spending the couple's own hand-out to do it.

Both halves fixed. `papic_seat_releasable_grants`' first ceiling nets off her spend —
her shots are attributed to her own purchase first, which is the attribution
`papic_guest_self_funded_spend` already makes with `LEAST(spent, paid)`. And that
function now nets off what she released, so donated credits stop counting as hers.

⚠ Its body was copied from the **applied** definition with three lines changed, per the
`CREATE OR REPLACE` time-machine trap that already bit this migration once. A
comment-stripped assertion fails if a later replacement drops the subtraction.

Three existing test expectations were corrected rather than the fix loosened: 137 and 37
were the wrong answers.

SPEC IMPACT: `WHATS_NEXT_Shots_Per_Guest_2026-08-28.md` § 7b — records that the
give-back and the ceiling interact, and how.
