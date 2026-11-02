## 2026-08-30 · fix(security): the phantom-column guard now resolves `.from(REF)` too — the half #5020 missed

**SPEC IMPACT: None.** Test infrastructure only.

🚨 **#5020 TAUGHT `.select()` TO RESOLVE CONSTANTS AND LEFT `.from()` MATCHING A QUOTED
LITERAL ONLY — ONE LINE ABOVE IT, IN THE SAME FILE, WHILE THREE GUARDS ABOUT
LITERAL-ONLY MATCHING WERE BEING WRITTEN.** `FROM_RE` requires `.from('t')`, so
`.from(ALLOTMENT_STORAGE.table)` produced **no site at all** — not
checked-and-skipped, never enumerated, and therefore unable to appear in
`KNOWN_UNRESOLVED_TABLES` either. **An invisible gap is worse than an open one:
a ratchet cannot count what was never seen.**

**FOUND BY THE S3 SESSION, BY EXECUTION, AGAINST MY CLAIM.** I told it the
site was enumerated then skipped at `if (!table) continue`. It reintroduced a
real phantom — `.select('guest_id, points')` where the column is
`ceiling_points` — and watched all 21 tests pass over it. It was right and my
diagnosis was wrong.

🔑 **AND THE PATTERN THAT CREATES THE HOLE IS ONE WE RECOMMEND.** Collecting a
table name and its columns in one `*_STORAGE` object so a rename lands in a
single file is good practice — and it is exactly what makes `.from()`
unresolvable. **The rename-safe pattern is the phantom-unguarded pattern.**
Anyone adopting that shape inherited both halves. Now they get only the good one.

**Measured on `origin/main`:** 8 `.from(REF).select(…)` sites · **3 resolved** ·
5 unresolved (function parameters and locals — `.from(opts.table)` is not
statically knowable) · **0 new defects**. The genuine hole was small; it was
also invisible, which is the part worth ending.

**TWO INCOMPLETE FIXES CAUGHT BEFORE SHIPPING, BOTH BY TESTING AGAINST THE REAL
CASE RATHER THAN REASONING:**
1. **Same-file-only resolution would have missed its own motivating case.**
   `ALLOTMENT_STORAGE` is declared in `lib/papic-guest-allotments.ts`; the
   `.from()` sits in a component two directories away. Now: same-file first,
   then any **exported** constant. A file-local const still cannot resolve
   across files — that binding does not exist at runtime either.
2. **Constants were collected AFTER the `.from(` early-exit**, so the declaring
   file — which contains no `.from(` at all, the contract-module shape exactly —
   was skipped entirely. Moved before it. **T24 exists because behaviour cannot
   catch this: every test stayed green with the ordering wrong.**

**GUARDS (T22–T24):**
- **T22** — a phantom behind `.from(OBJ.prop)` is caught **across files**; a
  file-local constant does not leak across files; `Array.from` is not mistaken
  for a table read.
- **T23** — ratchet: unresolved `.from(REF)` sites may only shrink (ceiling 5),
  with an anti-vacuity floor, and `sites` must **be** the union of all three
  resolution paths.
- **T24** — source guard on the collection ordering above.

**MUTATION-TESTED — 5 sabotages, each needle counted, all RED** (baseline 24
pass / 0 fail): from-ref resolution always fails → 2 red · cross-file resolution
removed → red · `refResolved` dropped from the union → 2 red · `Array.from`
filter removed → red · collection moved after the early-exit → **T24** red.
🪤 One sabotage first reported **0 → 0 — DID NOT LAND** on a wrong needle and was
re-run against the real string rather than accepted.

✅ **T20's union assertion caught this change itself** — it went red until the
union learned about the third path, which is exactly what it was written for.

**Verification:** `lib/security` **120 pass / 120** · `TSC_EXIT=0`, 0 errors,
under the shared mutex with an 8 GB heap.
