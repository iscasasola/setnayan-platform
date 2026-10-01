# Guest import from a template file — progress (branch rd/guest-import-template)

Owner decision: corpus DECISION_LOG.md, 2026-10-01 rows "GUEST IMPORT = A TEMPLATE FILE…" and "GUEST IMPORT: HOW THEY GET THE TEMPLATE + UPLOAD AGAIN TO UPDATE".

| Step | State |
|---|---|
| 1. Download the template (per event type) | DONE — public/templates/*, lib/guest-import-file.ts `guestTemplateFor`, page section "1 · Get the guest list file" |
| 2. Upload the file (CSV; friendly headers) | CODE DONE — import-form.tsx (client, useActionState) + actions.ts mode=preview; .xlsx refused with 'save as CSV' (no xlsx parser in repo) |
| 3. Preview before adding | CODE DONE — lib/guest-import-file.ts planGuestImport; one row per row, 'need a look' never merged |
| 4. Upload again to update | CODE DONE — match first+last(+suffix) or mobile+one name; patch only changed non-empty fields; RSVP never overwritten |
| Verify | lint + 26 CI guards + touched tests GREEN locally; local tsc OOMs on this Mac → CI typecheck is the gate; full unit suite run: 2 sweep failures (numbers-carry-commas, role-names-reach-every-screen) fixed; NOT browser-checked (needs a signed-in event) |
| Housekeeping: 5 root *_PROGRESS.md deleted | DONE |

Guard: apps/web/lib/guest-import-file.test.ts (run from apps/web: `npx tsx --test lib/guest-import-file.test.ts`).

## Not done / next
- **.xlsx upload**: no spreadsheet parser in the repo (checked package.json for xlsx/exceljs/sheetjs/fflate as a direct dep — none). Zero-dependency path if wanted: unzip with `node:zlib` `inflateRawSync` + read `xl/sharedStrings.xml` and `xl/worksheets/sheet1.xml` (~120 lines, server-only), feed rows to `readGuestFile`'s mapping. Today an .xlsx gets "save it as CSV first".
- **"Open in Google Sheets"** (DECISION_LOG row 2): owner action first — create the template sheet in Setnayan's Drive, share view-only, then link its `/copy` URL next to the download button.
- **Clearing a field by upload** is deliberately impossible (an empty cell never blanks) — say so if the owner asks.

## Handoff (2026-10-01, account closing)
- All 4 steps + housekeeping are CODED and pushed. PR #6225 stays DRAFT + `do-not-auto-merge`.
- CI on the commit before the last failed only on `role-names-reach-every-screen` — fixed in "import reads and shows the couple's own role words". CI for that head was still running at handoff: check `gh pr checks 6225`; if green → `gh pr ready 6225` (keep the label, never merge).
- Not browser-checked yet (needs a signed-in event): open /dashboard/<eventId>/guests/import on a phone, download the file, upload the CSV, see the preview, Save.

## CI fix (2026-10-01)
- Required check "typecheck + lint" failed on one db test, `ugat-both-ends` ("result-dropped-silently": the re-upload `guests.update` in import/actions.ts counted the failure but kept no reason). Fixed by logging the Supabase error with `[supabase-error]` + event/guest ids; the user-facing "skipped" count is unchanged. No baseline touched.
