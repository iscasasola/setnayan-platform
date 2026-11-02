## 2026-07-10 · fix(vendors): route the shortlist bench-avatar radius through a token

`.slcat .bmr-av` (the 32px bench-avatar in the Shortlist categories view) had a
hardcoded `border-radius:9px`, which reds the strict radius guard
(`RADIUS_LINT_STRICT=1 node apps/web/scripts/lint-radius.mjs`, the CI "lint radius
tokens" job). It landed via the marketplace bench-search work (PR #3012) and
slipped through because that guard is NOT a required check, so every later PR
inherited a red guard.

Fix: `border-radius:9px` → `border-radius:var(--m-r-sm)` (8px — the nearest token
to 9px; `--m-r-md` is 14px). A 32px avatar keeps its soft-squircle read.

Strict radius guard now passes tree-wide (this was the only ad-hoc site); `tsc`
clean. CSS-only, 1px delta — no functional or visible change.

SPEC IMPACT: None.
