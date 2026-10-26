## 2026-10-27 · ci(e2e): cache the apt packages and install them behind the build — the suite was never the slow part

`playwright e2e (chromium)` was being **cancelled** at its 25-minute cap (batch 8
#6966 job 121615601129, #6970 job 121690883112), each costing a manual re-run
and ~40 minutes before a deploy. The log of each ends mid-suite with every
executed test passing, which reads like "the suite is too long".

**It is not.** Measured over 59 job attempts (2026-10-24 → 27):

| step | 47 successes (min · median · max) | the 8 runs cut off at 25 min |
|---|---|---|
| Install Playwright Chromium | 0.2 · 0.2 · 7.4 min | **10.2 – 17.4 min** |
| Build web app (`next build`) | 7.6 · 10.1 · 11.4 min | 7.3 – 9.9 min |
| Run Playwright tests | 5.1 · 5.8 · 6.0 min | cut off |
| whole job | 13.7 · 16.8 · 24.9 min | 25.1 – 25.4 min |

All eight cap-hits — 8 of 8 — lost their time in one step, and it was the apt
download inside `playwright install-deps`: job 121690883112 logged
`Fetched 25.9 MB in 10min 1s (43.1 kB/s)` from the runner's Ubuntu mirror. The
2026-08-19 fix (`changelog.d/e2e-stops-timing-out.md`) found the right STEP and
cached the wrong half of it: the browser binary, not the ~26 MB of `.deb`s
(fonts, libnss3, xvfb) the same step downloads every run.

**The fix, in `.github/workflows/e2e.yml`:**

1. **The `.deb` files are cached** (`~/.cache/playwright-apt`, keyed on the
   runner image + Playwright version, `restore-keys` to the previous image's
   set). They are copied into `/var/cache/apt/archives` before
   `playwright install-deps`, so apt finds them and downloads nothing; after
   the install the cache dir is re-seeded with exactly the installed versions,
   so superseded files do not pile up. The step prints apt's own
   `Need to get … of archives` line, so whether the cache worked is in the log.
2. **The install runs in the background, behind `next build`** (~10 min), and a
   "Wait for the Playwright system packages" step after the build collects its
   exit code — fail-closed: a non-zero exit fails the job with the apt log. So
   even a cache miss on a slow mirror is free until it outlasts the build.
3. **A per-file timing table** (`scripts/e2e-timing-summary.mjs`, fed by the
   JSON reporter that `playwright.config.ts` now adds on CI when
   `PLAYWRIGHT_JSON_OUTPUT_FILE` is set): every run's step summary names its
   slowest spec files and tests, and counts retried and flaky tests. Diagnostic
   only; it never changes a result.

**Not sharded, on purpose.** The suite is ~6 of ~17 minutes; sharding it means
building once and shipping `.next` to every shard (or building N times), for a
saving of a couple of minutes — and this account runs at most 20 jobs at once
(`changelog.d/rd-ci-cancels-superseded-runs.md`: 20 running, 95 waiting), so
each shard is a runner slot another PR queues for. The timing table makes the
case measurable if the suite does grow into the problem. The largest remaining
lever is `next build` itself — "No build cache found", 7.8 min of webpack
compile — but caching `.next/cache` adds a large entry per `main` push against a
repo cache already at 6.07 GB of its 10 GB, so it is left for a decision rather
than slipped in here.

**Measured on this PR's own CI (run 40368055466):**

| | attempt 1 (cache miss) | attempt 2 (cache hit) |
|---|---|---|
| apt `.deb`s restored | 0 | 17 (25 MB) |
| apt said | `Need to get 25.9 MB` (fast mirror that hour) | **`Need to get 0 B/25.9 MB of archives`** |
| time the job waited for the packages after the build | 0 s | 0 s |
| install step before the build | 1 s | 0 s |
| Build web app | 8.9 min | 10.3 min |
| Run Playwright tests | 5.4 min (406 passed, 0 flaky) | 5.8 min (406 passed, 0 flaky) |
| whole job | **15.0 min** | **16.7 min** |

Honest reading: on an hour when the mirror is fast, the job takes as long as it
did before (13.7–18.7 min was the normal range). It was never slow on those
hours. What this removes is the 10–17-minute apt tail that took 8 of 59 attempts
past the cap. That tail can no longer happen on a cache hit, and on a miss it
has to outlast a ~10-minute build before it costs anything.

**What the timing table found:** `the-spotlight-ring-wraps-its-target.spec.ts`
is **77% of the suite's summed test time** (443 s of 578 s, 156 tests; each
tour × width test runs 6–7 s). Its `settled()` reads the ring, waits 400 ms,
and reads it again for every step of every tour. The next lever on the suite is
there. It is not touched here, because shortening that wait loosens a "the ring
stopped moving" check.

No test was skipped, removed or loosened; `timeout-minutes` stays 25.

SPEC IMPACT: None.
