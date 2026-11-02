# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-24 · chore(guest-site): open-browse PR11 (verification step) — enable open-browse on the sample event

Open-browse PR11 of 11 (council build-plan row 11), the **verification** step only. Migration `20270929637284` flips `events.website_open_browse` to TRUE for the sample/tour event(s) (`is_sample = TRUE`) so the owner can preview the COMPLETE open-browse guest website (PR7 engine + PR8 editorial-as-archive/empty-state/find-mode layer + PR9 couple manager) at the sample URL and verify it across the four lifecycle phases before the production launch.

**This does NOT launch open-browse to real couples.** It touches only `is_sample` rows; it does not change the column DEFAULT (new events stay FALSE), does not flip `NEXT_PUBLIC_WEBSITE_MENU_ENABLED` (the sample already renders the menu regardless), and does not delete `WIDGET_PHASES` or retire the legacy bars (post-soak cleanup, a later PR). Fully reversible (flip the column back / use the couple board).

The remaining go-live levers — new events default `website_open_browse=TRUE` at creation, the global menu flag, existing-events opt-in via the board, and the post-soak `WIDGET_PHASES`/bar retirement — are the owner's launch steps, staged for a follow-up PR after verification.

SPEC IMPACT: None — the demo-verification step of the already-signed-off council build plan; no schema change (data-only UPDATE on the sample event).
