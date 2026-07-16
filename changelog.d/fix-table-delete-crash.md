## 2026-07-16 · fix(seating): deleting a table no longer crashes the editor

Deleting a table in the seat-plan editor (plan/canvas view) crashed the app to the
global error boundary ("Something on our end didn't work"). Root cause: an infinite
render loop ("Maximum update depth exceeded"). Delete is the only op that mutates the
table SET through `useOptimistic` (`applyTableOpt`), and `useOptimistic` yields a fresh
`tables` array reference on every render while the optimistic and base states settle.
The two canvas layout effects — the auto-place resolver and the "N overlaps" mount-audit
— key off that reference AND write state (`setPositions` / `setMountAudit`), so an
in-flight delete made them re-run → rewrite state → re-render → re-run every frame until
React's update-depth cap tripped. The stricter post-#3305 collision model amplified it.
Only reachable in the plan (canvas) view; the list view doesn't mount the canvas. Pure
geometry unit tests never covered this event path, so it passed CI.

Fix: both layout effects skip while an optimistic mutation is in flight (`isPending`) and
re-resolve once cleanly when it settles — the transient optimistic table set was never
worth re-placing against anyway. Adds a jsdom component regression test that drives a real
plan-view delete (fails on the pre-fix code with the update-depth error, passes after),
wired into CI as `test:component`.

SPEC IMPACT: None
