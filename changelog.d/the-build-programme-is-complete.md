## 2026-09-01 · docs(build-sessions): C4 merged — the build programme is complete

C4 landed as PR #5054 at 00:47Z. Its `typecheck + lint` was FAILING when last checked at 08:11
local; it was fixed and merged. **Every C-session on the register is now shipped.**

**C4's premise is dead, verified against the code rather than the merge notification:**

    apps/web/app/dashboard/(account)/people/[dependentId]/page.tsx   ← the absent route
    lib/business-alaga.ts · lib/dependent-timeline.ts · lib/honoree-dependent-link.ts

    a-dependent-has-a-page.test.ts    tests=6  pass=6  fail=0
    business-alaga.test.ts            tests=5  pass=5  fail=0
    dependent-timeline.test.ts        tests=9  pass=9  fail=0
    honoree-dependent-link.test.ts    tests=15 pass=15 fail=0

35 tests, 35 passing, every count non-zero — so these are real passes, not the
zero-tests-zero-failures shape that exits 0 and reads identically to success.

⚠️ **What "complete" does NOT mean.** Eleven premises are false, which is evidence these things were
**built**. It is not evidence that any of them **work**. Not one has been exercised by a person
against production. § 6 item 1 — *a stranger completes the whole journey* — has never been
attempted, and P3 remains unscheduled.

🔑 **A finished build list reads exactly like a finished product.** That sentence is the one this
register exists to stop anybody believing, and it is cheapest to say now, at the moment the last
row goes green.

Both of the last two sessions — C1 (#5046) and C4 (#5054) — were **already building or built while
the board called them unstarted**. Three incidents of that shape in two days. A tracking document is
accurate only at the instant of measurement.

SPEC IMPACT: None — programme tracking.
