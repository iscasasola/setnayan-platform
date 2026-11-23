## 2026-11-21 · fix(batch-e): two guards that met newer main

- `lib/every-chat-page-has-a-report-door.test.ts` (from the Unichat stack): on main, the host's ⋯ is built by `hostMoreRows`, which #8092 and #8093 added (Call · Viber, Mute this chat). The guard now asserts that function's last `rows.push` is Report a problem and that the shell draws `more={hostMoreRows(`. Report is still the ⋯'s last row.
- `app/vendor-dashboard/repertoire/loading.tsx` (#8106): the redraw moved the title into `ToolPin`, so the ghost's "Your repertoire" was no longer the page's own words (`lib/the-ghost-falls-back-to-sheen.test.ts`). The title is now grey, like the other redrawn tool pages.

SPEC IMPACT: None
