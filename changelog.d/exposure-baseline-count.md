## 2026-08-16 · fix(security): the exposure baseline's counter lost a fact to a concurrent merge

`main` has been RED since `ce5ee9b8` and every open PR is blocked by it. Two
required checks fail, and **both are the same fact**:

- `lint exposure baseline` — *"TRUNCATED OR EDITED: header declares 6253 facts
  but the body holds 6254."*
- `typecheck + lint` → Data-layer guards → *"meta: the committed baseline
  exists, parses, is sorted, and is not truncated"*

🔑 **NOTHING WAS TRUNCATED OR HAND-EDITED. TWO PRs MERGED CONCURRENTLY.** Each
added exactly one `col` line and each bumped the header the same way, 6252 →
6253. Git merged the two bodies cleanly — different lines, no conflict — and
took the one header value both sides agreed on. **The body gained two facts and
the counter gained one.** The guard's own diagnosis names the two causes it was
written for and this is neither, which is why the message reads alarming.

Measured, per bucket, before touching anything:

| bucket | header said | body holds |
|---|---|---|
| facts | 6253 | **6254** |
| col | 4516 | **4517** |
| schema · rls · rlsforce · tpriv · policy · view · func | — | all match exactly |

So the correction is **two numbers**. No fact line is added, removed or edited.

🔒 **AND THE EXTRA FACT IS NOT A NEW EXPOSURE.** It is
`col public.event_vendors.lock_request_nudged_at → anon=SIU authenticated=SIU`,
from the lock-handshake data layer. **All 65 columns of `event_vendors` already
read `anon=SIU`** — the new column inherits the table-wide grant that was
already there, so nothing widens. (That table-wide `anon` grant is real
pre-existing debt and is deliberately **not** touched here; narrowing it is a
security decision with its own blast radius, not a counter fix.)

⚠ **WHY THIS IS NOT `pnpm exposure:baseline`.** The documented remedy
regenerates the whole file from a live database — which would have accepted
whatever else had drifted, silently, under cover of unblocking CI. **A baseline
is a bill, not a decision.** The two stale numbers were derived by counting the
committed body, so this change is provably an arithmetic reconciliation of the
file against itself and nothing else.

Verified: `node scripts/lint-exposure-baseline.mjs` → *"exposure baseline lint
OK — file is canonical, floors met, guard is wired."*

SPEC IMPACT: None.
