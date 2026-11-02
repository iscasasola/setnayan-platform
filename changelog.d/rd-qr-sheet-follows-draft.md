## 2026-10-06 · fix(maker): the Guest QR codes preview wears the drafted QR look

Owner, desktop Maker, Details › For the Day › Guest QR codes: *"i changed the QR
Code style, why did the QR codes not change?"* The QR style picked in Details ›
Your Event Hub › QR code is saved to the draft. The event QR beside the address
already drew that draft (`/api/website/qr/[slug]?draft=1`). The Guest QR codes
sheet (`/api/hub-print/qr-codes`, the free branch) used `resolveEventQrLook` on
the live row only, and its preview address named no draft. So every guest's
code in the Maker ignored the new style.

- `qrLookForHostDraft` (`lib/qr-look.server.ts`) is now the one rule for every
  Maker preview of a code. When the draft holds a QR look, that look is laid
  over the live row and shown as Pro would show it (Pro still decides at
  Apply). The event QR route, the sheet and `loadPrintSet` (each set piece's
  corner QR and pass) all use it.
- The sheet's thumbnail (`mode=screen` with `draft=`) reads the host's draft
  after the host gate. A saved PDF (`mode=print`, or no mode) never reads the
  draft.
- `style_preferences` has joined `PRINT_DRAFTED_KEYS`, so the Maker's draft
  hash now changes when the QR look changes. The sheet's preview and the free
  Event QR preview carry `v=`/`draft=`, so the thumbnail reloads. The saves
  carry neither.
- Guests are unaffected: every guest-facing route still calls
  `resolveEventQrLook` on the live row.

Guarded by `apps/web/lib/the-qr-sheet-follows-the-draft.test.ts`. It runs the
real route `GET` on a maria-and-jose-shaped fixture. Three sabotages (sheet
back to live-only; a print reading the draft; the key dropped from the list)
each turned it red.

SPEC IMPACT: None.
