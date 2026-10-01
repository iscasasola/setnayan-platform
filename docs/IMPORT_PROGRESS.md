# Guest import from a template file — progress (branch rd/guest-import-template)

Owner decision: corpus DECISION_LOG.md, 2026-10-01 rows "GUEST IMPORT = A TEMPLATE FILE…" and "GUEST IMPORT: HOW THEY GET THE TEMPLATE + UPLOAD AGAIN TO UPDATE".

| Step | State |
|---|---|
| 1. Download the template (per event type) | DONE — public/templates/*, lib/guest-import-file.ts `guestTemplateFor`, page section "1 · Get the guest list file" |
| 2. Upload the file (CSV; friendly headers) | in progress |
| 3. Preview before adding | todo |
| 4. Upload again to update | todo |
| Housekeeping: 5 root *_PROGRESS.md deleted | DONE |

Guard: apps/web/lib/guest-import-file.test.ts (run from apps/web: `npx tsx --test lib/guest-import-file.test.ts`).
