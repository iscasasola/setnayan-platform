## 2026-11-27 · perf(shell): the bell and switcher reads start with the shell's own (speed audit A2)

On every signed-in public page, `AppRailShell` waited for its own reads, and only then drew `SignedInCluster`, which then began its bell and account-switcher reads. Two waits in a row.

The shell now starts those two reads in its own batch, keyed on the request's one `getCurrentUser`. The cluster awaits the same per-request `cache()` promises and finds them already on their way. This happens only when the shell draws the cluster (no `topBarSlot` handed in). Nothing is read for a signed-out visitor. Nothing on screen changes.

Measured with `scripts/audit/page-rounds.mjs`: `/about` signed in went from 10 rounds to 2. The tracer counts a started read as done. In practice the cluster now finishes at the slower of the rail and its own reads, not their sum, which saves about one trip.

Guard: `app/_components/frontdoor/the-cluster-reads-start-in-the-shell-batch.test.ts`. `force-dynamic` (A1) is untouched.

SPEC IMPACT: None. A speed fix with no visible change.
