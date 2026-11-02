## 2026-08-19 · ci(e2e): cache the Playwright browser so the job stops hitting its own timeout

Three PRs sat `BLOCKED` with no failing test. The blocker was `playwright e2e
(chromium)` reporting **cancelled** — which is what GitHub calls a job that hits
`timeout-minutes`.

**Measured over 30 runs before changing anything:** 22 success (5–14 min), 5
cancelled — and **every cancellation was exactly 15m**, the timeout, with the job
dying inside *Install Playwright Chromium*. One of the five was on `main`, so it
is not branch-specific, and successes finishing at 14m are one slow minute from
the cap.

The browser download is the variable part, so this caches it (keyed on the
resolved Playwright version) rather than raising the ceiling and waiting for the
tail to catch up again.

🔑 **A CANCELLED CHECK IS NOT A FLAKE TO RE-RUN.** Re-running it three times
produced three more cancellations and no information. The duration was the tell,
and it was one query away.

⚠ **A cache hit still needs the OS-level shared libraries**, which live outside
`~/.cache/ms-playwright` and are not restored by the cache — so a hit runs
`playwright install-deps` and only a miss re-downloads the browser. The key
carries the version, so a Playwright bump misses the cache and re-downloads
instead of silently testing against a stale browser.

SPEC IMPACT: None.

### The cache could not land itself — the ceiling had to move too

Re-running the cancelled check three times produced three more cancellations,
which is exactly what this fragment already warns about. The reason is
structural: **this PR must pass the very check it repairs, on a run that has no
cache yet to benefit from.**

So `timeout-minutes` goes **15 → 25**, and the number is derived rather than
picked: across the 30 measured runs the SUCCESSES ranged **5–14 minutes** against
a **15 minute** cap. **A ceiling one minute above the observed maximum is not a
timeout, it is a coin toss** — and five runs, one of them on `main`, lost it.

The cache is still the actual fix and should pull normal runs back to ~5 min, at
which point the higher ceiling costs nothing and only catches a genuine hang.
