## 2026-07-31 · fix(ci): give `typecheck` the same heap bump `build` already has

`typecheck + lint` failed on PR #3979 with **exit 134 — "FATAL ERROR:
Ineffective mark-compacts near heap limit — JavaScript heap out of memory"**.

Not a type error and not a lint error: `tsc` ran out of heap on the runner.

**Not caused by that PR.** The same OOM hit locally on the FIRST `tsc --noEmit`
of the session, before any edit — the codebase has simply grown past Node's
~4 GB default. The PR's ~40 added lines cannot move that; it just happened to be
the run that tipped.

The repo already solved this for the heaviest job and never applied it here:

```
"build":     "node scripts/stamp-sw.mjs && NODE_OPTIONS=--max-old-space-size=7168 next build",
"typecheck": "tsc --noEmit",                    ← no bump
```

Matched `build`'s proven 7168 rather than inventing a number — same runners, same
constraint, and a value already known to fit.

⚠ This is a shared CI script, so it affects every PR. That is the point: left
alone it is an intermittent red on work that has nothing wrong with it, and the
next person to hit it would reasonably start debugging their own diff. Verified
by running `npm run typecheck` (the exact command CI runs) to completion.

SPEC IMPACT: None — build tooling only.
