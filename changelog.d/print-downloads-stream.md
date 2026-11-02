## 2026-10-17 · fix(prints): every print PDF leaves as a stream — a buffered body over 4.5 MB is refused by Vercel

LIVE FAULT. A Vercel Function's buffered response body stops at 4.5 MB (`413 FUNCTION_PAYLOAD_TOO_LARGE`, Vercel docs › Functions ›
Limits); a streamed one does not (Vercel KB, "How do I bypass the 4.5MB body size limit"). Measured with the routes' own drawing code
(Classic): every guest's pass (`/api/hub-print/passes`) is 5.15 MB at 109 guests — production's largest event — and 11.35 MB at 240;
the place-card pack passes 4.5 MB at about 280 guests, the QR sheet at about 470.

- `lib/stream-file.ts` `bytesStream`: the SAME bytes in 1 MB parts, no Content-Length — the shipped big-file way
  (`/api/guest/pass-card/all`).
- Streamed: every PDF of `/api/hub-print/[piece]` (its one `pdfResponse` door: every guest's pass, one guest's pass, each piece,
  the whole set, the QR sheet, the guest list registry) and of `/dashboard/<id>/seating/{print,export,caterer}` (the place-card
  pack, the entrance chart, the 2D seat plan, the caterer's counts). `maxDuration = 300` on all four routes (hub-print was 60).
- No feature, wording or Pro change; previews, the sample JPEG and the caterer's CSV are untouched.
- Guard: `apps/web/lib/print-downloads-stream.test.ts` (5 sabotages, each red).

SPEC IMPACT: None.
