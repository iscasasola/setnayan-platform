## 2026-09-19 · fix(your-team): the mobile team chip says "to lock", like the tile beside it

S19 renamed the "In build" tile to "Still to lock" because right after a lock it read "In build
₱0" beside "Locked ₱10,170". The floating chip on phones counts the same thing
(`inBuildCount` — build picks not yet locked) and still read "1 locked · 0 in build". Visible
text and the screen-reader summary now both say "to lock". Guarded in `deposit-pay-step.test.ts`.

SPEC IMPACT: None
