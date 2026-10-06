## 2026-10-06 · fix(ci): the scheduled deploy sees its `deployed-prod` marker and stops rebuilding unchanged code

`deploy-prod.yml`'s checkout was the default shallow, tag-less clone, so `git rev-parse refs/tags/deployed-prod` never found the marker the previous run pushed; "Is there anything new to publish?" failed OPEN on every 4-hourly run and rebuilt production with nothing new (measured: run 37398273288, 01:15Z, "no deployed-prod marker yet — publishing (fail OPEN)" while the tag existed on origin at the same sha). Each no-op rebuild is a new deployment; an open Maker tab still on the previous one then failed its next request and showed the app error page (owner, live iPhone 09:23 PHT). Checkout now fetches full history + tags (`fetch-depth: 0`, `fetch-tags: true`), which `git rev-list deployed-prod..HEAD` also needs.

SPEC IMPACT: None
