## 2026-10-23 · ci(e2e, lighthouse): a newer push to the same PR cancels the older run

GitHub runs at most 20 jobs at once on this account (measured 23 Oct: 20 running, 95 waiting; the deploy sat queued 50 min). `ci.yml` already cancels a PR's superseded run; `e2e.yml` and `lighthouse.yml` did not, so every builder push left an older end-to-end build and Lighthouse audit holding runner slots. Both now use ci.yml's rule: the group is per pull request and cancels in progress; every other event (push to `main`, manual dispatch) gets a group of its own and always runs to the end.

On `main`, the newest push now cancels the older still-running `ci` and `e2e` runs (groups `ci-main` / `e2e-main`, cancel-in-progress): the newest main commit contains every earlier merge, so its run answers for all of them. A 7-PR batch used to queue 7 × ~25 main jobs. A manual dispatch still gets a group of its own.

SPEC IMPACT: None.

Also fixes `main`'s red unit test: #6824's initials guard (`avatar-initials-read.test.ts` test 3) caught the dev Memories lab's white-on-gold "IC" chip from #6778 — it now uses the shared `.sn-initials` class.
