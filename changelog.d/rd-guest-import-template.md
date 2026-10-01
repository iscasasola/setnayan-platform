## 2026-10-01 · feat(guests): guest import from a template file — download, upload, preview, upload again to update

Owner 2026-10-01 (DECISION_LOG "GUEST IMPORT = A TEMPLATE FILE YOU DOWNLOAD…" + "…UPLOAD AGAIN TO UPDATE").

- **Download the template** — `/dashboard/[eventId]/guests/import` now offers "Download for Excel / Numbers" (.xlsx) and a small CSV link, served from `apps/web/public/templates/` (copied from the corpus `templates/`). A wedding gets the file with Side; every other event type the general one — chosen by `guestTemplateFor(eventHasSides(roleSet))` in `lib/guest-import-file.ts`, never by a list of type names.
- Housekeeping: deleted five stale builder notes at the repo root (BAR_PROGRESS.md, BUILDMEM_PROGRESS.md, F2_PROGRESS.md, HOME_PROGRESS.md, TEAM_PROGRESS.md).

SPEC IMPACT: None
