## 2026-09-27 · fix(guests): the guest list opens again — the QR buttons no longer crash the page

In production the couple's guest list failed with "Something on our end didn't work" (digest 3329950423). The server log said: "Functions cannot be passed directly to Client Components". Two server components, `roster-tabs.tsx` (the "Download QR codes (PDF)" door) and `guest-detail-body.tsx` (a guest's "Download QR"), mounted the client `SaveFileLink` with its render-function child. A function can't cross from server to client, so the whole page threw whenever either button was on screen. It shipped with 233963c22 (2026-09-26).

- Both buttons now live in `guests/_components/guest-save-links.tsx`, a `'use client'` file. The server components pass it only strings.
- New guard in `lib/a-qr-download-never-opens-a-new-page.test.ts`: `SaveFileLink` may be MOUNTED only from a `'use client'` file. It sweeps the whole `app/` tree, so a new caller is caught without anyone updating a list. Sabotage-proven twice.
- `roster-doors.test.ts` and the SaveFileLink guard now follow the buttons into the wrapper file.

SPEC IMPACT: None.
