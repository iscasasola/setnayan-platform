## 2026-08-30 · fix(security): the phantom-column guard no longer goes blind to `.select(CONSTANT)`

**SPEC IMPACT: None.** Test infrastructure only — no product behaviour, no schema, no migration.

`select-column-scan`'s phantom check (T1) matched only a QUOTED select argument.
Rewriting `.select('some_col')` as `.select(SOME_COLUMNS)` produced **no site at
all**, so the call was never checked and never reported. It did not resolve the
constant and pass — **it stopped looking.**

🚨 **A PROOF TOOL THAT FAILS OPEN IS WORSE THAN NO PROOF TOOL,** because its green
is read as evidence. Same defect class as the comment stripper repaired in #5018
the same day: the guard reports success while asserting against nothing.

**HOW IT WAS FOUND.** The S4 session (#5019) hit a legitimate T1 failure —
`papic-guest.ts` selecting `points_cost`, a column S2's unmerged migration
creates — and made it green by moving the name behind a constant. Runtime
behaviour was byte-identical: PostgREST still received `points_cost` and still
answered 42703. Caught in review, reverted, and #5019 now keeps the literal and
stays deliberately red until its migration lands.

**MEASURED, before → after** (the number is the size of the hole):

| | before | after |
|---|---|---|
| literal select sites checked | 3,558 | 3,558 |
| constant select sites checked | **0 of 74** | **71 of 74** |
| still unresolved (surfaced, not dropped) | 74 | **3** |
| phantom findings | 8 | 8 |
| **new defects revealed** | — | **0** |

✅ **ZERO NEW DEFECTS IS THE HONEST RESULT AND IS REPORTED AS SUCH.** 74 select
sites were unchecked; none of them was actually broken. The hole was real, the
exposure was not. Reporting a scary number would have been easy and false.

🔑 **THE SECOND HALF WAS THE LARGER ONE.** Wiring the existing
`extractSelectConstants` in only reached 25 of 74, because it matches
`export const` — and **38 of this repo's 75 canonical declarations are
file-local.** New `extractAllSelectConstants` reads both and tags which.
`extractSelectConstants` is deliberately left alone: the omitted-column guard
compares against a SHARED constant, where a file-local list correctly does not
count. Widening it there would have changed a different guard's meaning.

⚠ **SCOPE IS ENFORCED, NOT ASSUMED.** A file-local constant resolves only within
its own file; otherwise an exported one. Resolving `lib/a.ts`'s local constant
for a site in `lib/b.ts` would invent a binding the compiler itself rejects.

**THE GUARDS ON THE GUARD** (T19–T21), because behaviour alone cannot catch this
regressing while the repo hides zero constant phantoms:
- **T19** — a phantom named through a constant is still reported; plus the
  cross-file scoping rule.
- **T20** — ratchet: unresolved constant sites may only shrink (ceiling 3), with
  an anti-vacuity floor, and `sites` must BE the union of literal + resolved.
- **T21** — reads T1's own wiring, because reverting T1 to the literals-only
  scan would change **no test result today** and silently restore the blind spot.
  Comments stripped with the shared stripper, since the docblock names the very
  function it forbids.

**MUTATION-TESTED — 5 sabotages, each needle counted 1 → 0, all RED** (baseline
21 pass / 0 fail): T1 reverted to the literals-only scan → T21 red · local
constants no longer extracted → T19+T20 red · resolution always fails →
T19+T20 red · resolved sites computed then discarded → T20 red · file-local
constants leaking across files → T19 red.

🪤 **AND THE TYPECHECK LIED ONCE ON THE WAY:** first run reported
`TSC_EXIT=134` with `ERROR_LINES=0` — heap exhaustion, not a mutex collision.
An empty error log is not a clean one. Re-run with a larger heap: `TSC_EXIT=0`,
0 errors.
