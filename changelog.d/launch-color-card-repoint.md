# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-24 · fix(website): point Launch's color cards at /website/colors (PR-C follow-up)

Re-points the Launch page's Background-color + Button-color Website Pro cards from the placeholder `/site-editor` href to the real `/website/colors` editor shipped in PR-C (#3663). PR-C could not do this itself — PR-A's redesigned launch page wasn't on `origin/main` when PR-C branched. Two `href` changes only.

SPEC IMPACT: None — wiring fix completing the Launch settings-first / Website Pro build (PR-A #3661 + PR-B #3664 + PR-C #3663).
