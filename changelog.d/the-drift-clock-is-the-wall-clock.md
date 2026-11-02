## 2026-09-06 · fix(deploy-drift): the drift monitor's clock is the wall clock

`deploy-drift-monitor` went red on four healthy deploys today. Looking into it
found a real defect underneath the noise — in the opposite, dangerous direction.

**`oldestPendingAgeSeconds` measured from main's TIP, not from now.**

```js
const now = Number(shSafe('git log -1 --format=%ct origin/main')) || …
return now - Number(ct);
```

`now` was the committer timestamp of `origin/main`'s tip, so the "age" was the
span **between two commits**, not how long a change had been waiting. Measured:
the monitor reported *"oldest pending change merged 46 min ago"* (tip 06:06:09Z
minus the pending commit at 05:20) while the true age was already 64 minutes —
and the reported figure could never grow again.

**That defeated the hourly cron, the one thing added to close the blind window.**
`deploy-drift-monitor.yml`'s own schedule exists because *"drift beginning after
the last merge of the day goes unreported until the next one"*. With `now`
frozen at the tip, the age stops growing the moment merging stops. A deploy that
breaks right after a merge landing five minutes behind it sits at "5 min old"
forever — permanently inside the 20-minute grace — and every hourly run reports
*"within grace — normal deploy latency, not drift"* while production serves
stale code indefinitely. **A monitor reporting healthy while the thing it
watches is broken: the exact disease it was built to catch, reproduced inside
the watcher.**

- `scripts/deploy-drift-doctor.mjs` — age now comes from `Date.now()`, extracted
  as an exported, unit-tested `pendingAgeSeconds()` and clamped at 0 so clock
  skew cannot read as a future commit (negative < grace = falsely healthy).
- `scripts/deploy-drift-doctor.test.mjs` — 5 new tests, including one that
  asserts the age GROWS with no new commits. Mutation-checked: re-freezing the
  clock turns 4 of them red. Already wired into CI (`ci.yml`).

**Why the existing tests missed it:** they covered `classifyDeployDrift`, the
pure classifier — and it was correct. The bug was in the untested half that
FEEDS it. A right classifier given a wrong number is still a wrong monitor.

⚠ **NOT CHANGED — an owner call.** The 20-minute grace is shorter than real
pipeline latency when merges queue: four merges in ~45 minutes today, each
Vercel build ~7 minutes, so production trails legitimately and the monitor
alarms on healthy deploys. Raising the grace is a number that governs alerting;
it should be measured and set deliberately, not guessed here.

SPEC IMPACT: None.
