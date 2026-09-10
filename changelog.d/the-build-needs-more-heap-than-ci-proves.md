## 2026-09-07 · fix(build): give the production build the heap Vercel actually needs

Raised `apps/web`'s build ceiling from `--max-old-space-size=7168` to `12288`, and
added `apps/web/lib/the-build-has-headroom-ci-cannot-prove.test.ts` to hold both
that floor and the presence of the `typecheck` script's own flag.

**What happened.** Every production build from 20:42 PHT onward died on Vercel with
`FATAL ERROR: Ineffective mark-compacts near heap limit … exited (137)` — PRs #5287,
#5289, #5292 and #5295, four in a row. Nothing looked red: CI's own `production build`
job (`.github/workflows/ci.yml`, `runs-on: ubuntu-latest`, `node-version: 22`) passed
on the very same commits — 7m38s green for #5287 — so every PR auto-merged normally.

**Why CI could not see it.** The two builds are different machines running different
Node majors: CI is 4 cores / Node 22, the Vercel build machine reports `30 cores, 60 GB`
and the project is pinned to `24.x`. Their heap high-water marks differ, and ours had
crept to within a few hundred MB of the 7168 MB ceiling — so a ~30-line addition to
`reception-scene.ts` (`photo_wall` decor, #5287) was enough to push the Vercel side over
while the CI side stayed under. The change on top when it crossed was not the cause; the
app's size was. `ra2/photo-wall-decor`'s **preview** build had already failed twice
(18:05 and 20:03) before it merged.

**The blast radius, which is the real finding.** Because a failed Vercel build produces
no deployment, the production alias never moved. `deploy-drift-monitor` correctly
reported `✗ DRIFT — production is 425 commit(s) behind origin/main` on five consecutive
runs, and its only alert is a red tick in the Actions tab, which nobody reads when every
PR says green. The 425 figure has a second cause layered on top: at 20:50 a deployment of
`claude/front-door-drops-hero-for-anchor` (92a17df9, an ancestor of main from ~4 days
back) landed with `target: production` and took the `www.setnayan.com` alias, so
production regressed further than the stalled builds alone explain. A green build from
`main` reclaims the alias.

**Two things this fragment does NOT fix, both owner calls:**
- The Vercel deployment check is not a required check on `main`, which is why four
  known-broken builds merged. Making it required is a branch-protection change.
- `deploy-drift-monitor` alerts nowhere but the Actions tab.

SPEC IMPACT: None — build configuration, no product behaviour or schema change.
