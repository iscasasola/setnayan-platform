## 2026-10-23 · ci(e2e, lighthouse): a newer push to the same PR cancels the older run

GitHub runs at most 20 jobs at once on this account (measured 23 Oct: 20 running, 95 waiting; the deploy sat queued 50 min). `ci.yml` already cancels a PR's superseded run; `e2e.yml` and `lighthouse.yml` did not, so every builder push left an older end-to-end build and Lighthouse audit holding runner slots. Both now use ci.yml's rule: the group is per pull request and cancels in progress; every other event (push to `main`, manual dispatch) gets a group of its own and always runs to the end.

SPEC IMPACT: None.
