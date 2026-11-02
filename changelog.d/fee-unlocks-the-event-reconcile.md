## 2026-09-20 · fix(booking-fee): feeDueCopy now derives from the same flag `eventAccessUnlocked` reads

Follow-up to `fee-unlocks-the-event.md`'s "Reconciling the overdue copy with
#5737" note, landed the moment #5737 merged to `main` and this branch was
rebased onto it.

`feeDueCopy` (`lib/booking-fee-disclosure.ts`) used to hand-write "Your booking
is not affected and your couple sees nothing about it", proved true only by a
test that greps `lib/vendor-room-access-rule.ts` for the fee — the wrong cell,
since the real, flag-gated consequence lives in this PR's
`eventAccessUnlocked`. `feeDueCopy`'s overdue detail now calls
`feeEnforcementSentence()` (`lib/event-access-stage.ts`) instead of duplicating
the sentence.

The flag's literal name is deliberately **not** duplicated into
`lib/booking-fee-disclosure.ts` — `the-fee-unlocks-the-event.test.ts`'s "the
gate is read from ONE flag" guard forbids a second literal reader, and adding
one would be the exact class of bug this reconciliation exists to prevent.
`lib/the-fee-finds-the-supplier.test.ts`'s cross-lane tripwire is re-pointed to
assert the mechanism instead (the import exists, and the printed sentence
matches `feeEnforcementSentence()`'s live output), and its "access rule
ignores the fee" assertion now calls `eventAccessUnlocked` directly rather than
grepping `vendor-room-access-rule.ts`.

SPEC IMPACT: None — this is the wiring the corpus row for 2026-09-20 already
anticipated; no new decision.
