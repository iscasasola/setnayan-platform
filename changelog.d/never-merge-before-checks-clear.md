## 2026-09-29 · docs(claude-md): never merge until every check has cleared

The owner locked a rule for every session and account: "never allow merge until
everything is cleared". Added as the first block of `CLAUDE.md` → "PR workflow":
no `gh pr merge --admin`, no bypass, no merging on a local-only check, even when
the owner says "merge now". The lever for "live sooner" is the deploy, not the
merge. This follows #6140 and #6134 being admin-merged before their checks ran.

SPEC IMPACT: None (process rule; recorded in repo CLAUDE.md, which every session reads).
