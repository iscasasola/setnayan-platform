## 2026-08-06 · fix(join): switch the throttle ON — it shipped built, tested, and doing nothing

PR #4160 built the guest-list self-join throttle, tested it exhaustively, and **watched every guard
go red**. It still protected nothing. The function that mints a guest identity —
`selfJoinAction` — lived in a file owned by an open PR at the time, so nothing ever called the
helper. Green CI, real tests, zero effect.

The builder said so honestly in its own summary, under "HONEST SCOPE LIMIT", and an adversarial
reviewer marked the stream **not sound** for exactly this. Both were right, and it would still have
been easy to read that PR as finished. This is the three lines that make it real.

🔑 **A guard that is not CALLED is not a guard, and no test of the guard can tell you.**
`join-door-throttle.test.ts` passed 16/16 the whole time — it tests the helper, and the helper was
always correct. The missing thing was one call. So the new test asserts the **call site**, not the
behaviour: `join-throttle-adoption.test.ts` reads `selfJoinAction` and fails if the consuming check
is absent, if a refusal does not return before any row is written, or if the non-consuming *peek*
is used at the mint instead. **Watched failing** — deleting the call turns 3 of its 4 red.

**Placement is load-bearing.** After token validation, so a junk token cannot spend a real event's
budget; before the mint, so a script cannot create rows. What is protected is not the token — that
is 128 random bits — but `SELF_JOIN_CEILING`: 1,000 self-added rows per event, **shared by
everyone**. Fill it and the door closes for every later visitor, with no in-product way for the
couple to reopen it, and a real guest at the reception is told the event is full.

Typecheck 0 errors; 67 tests pass across the six suites touching this path.

SPEC IMPACT: None.
