## 2026-07-31 · chore(ci): remove the retired-strings guard and its blocklist

Owner decision, same session as the corpus cleanup: *"retired is retired. actually i want retired gone and deleted so no unwanted memory saved."* Offered the alternative — delete the dead content but keep the one-line blocklist entry, so the guard could go on blocking a retired name from returning to a live page — and the owner chose **delete everything, leave nothing behind**, with that consequence stated and accepted.

**What went.** `apps/web/.retired-strings.json` (the blocklist — Pamahiya, Pareto, Custom Monogram Pack, `href="/apply"`, Memories Hub, the unbacked-scarcity wording), `apps/web/scripts/lint-retired-strings.mjs`, the `lint:retired` package script, and the `lint-retired-strings` job in `ci.yml`. Deleting the JSON alone would have failed the job on a missing config, so the removal is all four pieces together.

**Safe to remove without a branch-protection change** — `lint retired strings` was never in `required_status_checks.contexts` on `main` (verified against the API, not assumed). The 13 required checks are untouched; `ci.yml` drops from 20 jobs to 19 and still parses.

**What this costs, stated plainly.** This guard existed because the 2026-05-22 drift audit found Pareto and Custom Monogram Pack still on `/features` **eight days after** they were retired. Nothing now blocks that recurrence. The one place the codebase depended on it is `lib/subscriptions.ts` — `LAPSED_SUBSCRIPTION_SKUS` was kept honest in one direction by typecheck (a string that vanishes from `sku-catalog` breaks the build) and in the other by this guard (a *retired* SKU lingering in the list). That second direction is now unguarded, so the comment there says so and tells the next reader to check the list by hand when retiring a SKU.

Historical references in `CHANGELOG.md` and existing `changelog.d/` fragments are left alone — they record what past PRs verified, which is a log, not live config.

SPEC IMPACT: None — the matching corpus deletion landed separately in the spec repo (`a6a0e49`), with the full reasoning in `DECISION_LOG.md` 2026-07-31.
