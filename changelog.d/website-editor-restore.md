# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-25 · fix(website): restore the unified website editor (PR-1 + PR-2) + land PR-3

**Recovery.** PR #3668 (`feat(admin): Secrets & Rotation board`) was branched before the unified-editor work and merged with a stale tree, so it silently **reverted PR-1 (#3667) and PR-2 (#3669) in full** — deleting `app/[slug]/_components/editor-bridge.tsx` and the whole `website/editor/` route, and resurrecting the legacy `site-editor` internals (`site-editor.tsx`, `_data.ts`, `actions.ts`) that PR-2 had retired. Verified as a **pure revert** (every shared file on `main` was byte-identical to its pre-PR-1 state), so restoring is safe and loses no work from that PR.

This restores the editor and lands PR-3 in the same change:
- **PR-1 restored** — `/dashboard/[eventId]/website/editor` (rail ①②③ + live same-origin preview + phase tabs + `LaunchStdButton`), `editor-bridge.tsx` two-way sync, host-gated `?editor=1` (guest bytes unchanged), and every `/site-editor` link re-pointed.
- **PR-2 restored** — `/site-editor/*` and `/website/launch` back to redirects; legacy internals deleted again; `rsvp_backdrop` ported to `website/editor/actions.ts`; `routes.ts` · `add-ons-catalog.ts` · `nav-registry-defaults.ts` · `customer-menu.ts` (mobile Launch) · `studio/[addon]` · privacy back-link all re-aimed.
- **PR-3 lands** — `lib/editor-return.ts` (`resolveReturnTo`, opt-in + default-identical, open-redirect fenced, 4 unit tests) so inline panels return to the editor instead of a sub-page; `text-panel.tsx` inline panels wired for **Special message** + **What to bring**; rail rows with panels expand in place; `?open=<row>` re-opens after a save.

Gates: `tsc` clean · `next lint` clean · **32 unit tests green** (`editor-return` 4 · `site-body-plan` 19 · `anonymous-zero-guest` 4 · `site-menu` 4 · `customer-menu` + `nav-registry-defaults`). No migration.

⚠ Process note for parallel sessions: branch from the latest `origin/main` and re-check before merging — a stale-tree merge can silently delete another session's shipped work without a conflict.

SPEC IMPACT: None beyond the already-applied `DECISION_LOG.md` 2026-07-25 rows.
