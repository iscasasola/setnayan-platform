# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-24 · feat(guest-site): open-browse LAUNCH — new events default to open-browse

The production go-live lever for the open-browse guest website (council build-plan row 11). Migration `20270929824517` flips `events.website_open_browse`'s DEFAULT from FALSE to TRUE so every NEWLY-created event ships the five-tab open-browse site (PR7 engine + PR8 archive/empty/find-mode + PR9 couple manager). **Staged, auto-merge OFF — merging it is the deliberate launch.**

Council "no backfill" rule honored: it changes only the DEFAULT — it does NOT UPDATE any existing row, so in-flight weddings keep their current (FALSE) value and opt in via the couple board toggle rather than reshaping overnight. It does NOT touch `NEXT_PUBLIC_WEBSITE_MENU_ENABLED` (the bottom-nav is a global ENV flag — the owner sets it in the same launch window) and does NOT delete `WIDGET_PHASES` / retire the legacy bars (post-soak cleanup, a later PR). Fully reversible (`SET DEFAULT FALSE`).

SPEC IMPACT: None — the go-live step of the already-signed-off council build plan; schema DEFAULT change only, no new columns.
