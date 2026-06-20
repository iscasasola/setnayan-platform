## 2026-06-20 · chore(repo): kill the CHANGELOG/STATUS merge treadmill with per-PR changelog fragments

Every feature PR prepended to the top of `CHANGELOG.md` + `STATUS.md`, so any two concurrent PRs conflicted by construction. The existing `CHANGELOG.md merge=union` driver resolves that **locally**, but GitHub's auto-merge ignores `.gitattributes` merge drivers, so in-flight PRs kept flipping to `CONFLICTING` and stalled until someone hand-merged `main` in — a constant babysitting tax in this fast-merging repo.

Root cause confirmed: branch protection is **non-strict** (`required_status_checks.strict = false`), so a merely-*behind* PR auto-merges fine once green; the **only** blocker is the `CONFLICTING` state, which comes purely from the shared-top-of-file edits.

Fix — the news-fragment pattern (each PR writes a unique file, so PRs can't collide → they go `BEHIND`, not `CONFLICTING` → auto-merge fires unattended):
- **`changelog.d/`** — per-PR changelog entries land here as individual `.md` files (see `changelog.d/README.md`).
- **`scripts/changelog-collect.mjs`** — folds all fragments into `CHANGELOG.md` (newest first) and deletes them; run at release. No deps (built-ins only).
- **`CLAUDE.md`** — doc-contract updated: feature PRs add a `changelog.d/` fragment and do **not** edit `CHANGELOG.md`/`STATUS.md` directly; `STATUS.md` is a refreshed snapshot, not a per-PR log.
- **`.gitattributes`** — union driver kept as belt-and-suspenders (local merges + the collected file); comment points at the fragment pattern as the primary mechanism.

This PR dogfoods the pattern: its own entry is this fragment, and it touches neither `CHANGELOG.md` nor `STATUS.md` — so it cannot conflict.

SPEC IMPACT: None (repo tooling + doc-contract only). Logged in `DECISION_LOG.md`. ⚠ Owner: this changes how every future session records changes — surfaced for sign-off.
