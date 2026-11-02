# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-25 · refactor(website): retire /site-editor + merge /website/launch into the unified editor (PR-2)

PR-2 of 5 for the Unified Website Editor (owner-locked 2026-07-25: retire the legacy editor; "rebuild the launch page and improve it"). The dupe-kill.

- **`/site-editor/[eventId]` (+ `/rsvp` `/event` `/editorial`) → redirects** to `/dashboard/[eventId]/website/editor`. Deleted with it: `_components/site-editor.tsx` (1,333 lines), `_data.ts`, and its `actions.ts` — whose `saveHeroPhoto`/`clearHeroPhoto` were **byte-dupes** of `website/hero-photo/actions.ts` (the duplication PR #3642 flagged). Its 4 loading skeletons went too (redirects need none).
- **`rsvp_backdrop` ported** — the legacy editor's ONE unique setting (nothing else edits it, and the live site reads it) now lives in `website/editor/actions.ts`, verbatim logic with the gate swapped to the canonical `lib/host-gate` + `revalidate-site` helpers. Ported BEFORE the delete so the setting is never orphaned.
- **`/website/launch` → redirect** to the editor. PR #3661's settings-first surface became the editor's rail + topbar (go-live control, status chips, free settings, Website Pro band) — one surface instead of two siblings. Its `_components/WebsiteLaunchPreview` is removed (the editor's own preview pane supersedes it; nothing else imported it).
- **Every remaining pointer re-aimed at the editor** (a wider net than the design anticipated): `lib/routes.ts` `siteEditor.detail` · `lib/add-ons-catalog.ts` (the rsvp/event/editorial phase hrefs + the `landing-page` "Whole website" card — the consolidation its own TODO was waiting for) · `lib/nav-registry-defaults.ts` (sidebar Website + Launch + studio-subnav Launch routes) · the `studio/[addon]` phase redirect · the privacy page's back-link · and the Studio tab's stale `activeMatch`.
- **`lib/customer-menu.ts` — the MOBILE Launch item** still opened the live `/[slug]` (PR-1 only fixed the desktop sidebar). Now points at the editor too, so both navs agree. Caught by grep, not by the plan.

Grep proves zero runtime `/site-editor` or `/website/launch` references remain outside the two retired route files. No migration.

SPEC IMPACT: Applied — `DECISION_LOG.md` 2026-07-25 (Unified Website Editor + Launch merge).
