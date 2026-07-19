# Changelog fragments

Per-PR changelog entries live here as **individual files** so two PRs never
touch the same file. That's the fix for the merge treadmill: every feature PR
used to prepend to the top of `CHANGELOG.md` (and `STATUS.md`), so any two
concurrent PRs collided by construction. The `merge=union` driver in
`.gitattributes` resolves that locally, but **GitHub's auto-merge ignores
`.gitattributes` merge drivers**, so PRs still showed `CONFLICTING` on the
server and stalled until someone hand-merged `main` in.

Branch protection here is **non-strict** (`require branches up to date` is off),
so a PR that's merely *behind* auto-merges fine once its checks are green — the
**only** thing that blocks is a `CONFLICTING` state. A brand-new fragment file
can't conflict with another PR's fragment, so the PR stays `BEHIND`, not
`CONFLICTING`, and auto-merge fires on its own.

## Adding an entry (every non-trivial code change)

Create ONE new file here, named for your branch/change —
`changelog.d/<branch-slug>.md` — containing a normal CHANGELOG block:

```md
## 2026-06-20 · feat(scope): one-line summary

Body, with bullets if useful, ending in a `SPEC IMPACT:` line.
```

Commit it in your PR. **Do NOT edit `CHANGELOG.md` or `STATUS.md` directly in a
feature PR** — that reintroduces the conflict. Any "where we are" note goes in
the fragment too; `STATUS.md` is a refreshed snapshot, updated on its own, not
appended once per PR.

## Folding fragments into CHANGELOG.md

Run it anytime (typically at release):

```bash
node scripts/changelog-collect.mjs
```

It prepends every fragment here under the `---` divider in `CHANGELOG.md`
(newest first) and deletes the fragments. Until then, each fragment is
independently readable right here.
