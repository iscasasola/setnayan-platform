## 2026-11-05 · feat(shop): Shop › Promote › Prints — the supplier's calling card, standee, door print, backdrop, tarp, roll-up and table-front (part 3)

The owner APPROVED all 15 print looks on 5 Nov ("perfect") — Setnayan-specs `prototypes/supplier_prints_2026-11-05/`.
This is a NEW build: until now only the badge "Save to print" shipped.

- **Shop › Promote** gets a **Prints** section: a row "Calling card + tarps · 15 designs · 7 pieces" opens one sheet —
  **Design ▾** (the 15 looks, one `PickMenu`, never a pill row) · **QR on your prints ▾** (the shop's own codes:
  Check a date by default · Shortlist · My page) · **All 7 pieces**, each with **Save** · **See it in use** (the look +
  QR placed onto 8 real event photos with CSS `matrix3d`, the blank surface's light multiplied over it and the
  foreground drawn back in front, from `placement.json`). `ShopPrintsSection`.
- **ONE renderer** (`lib/supplier-prints-svg.ts` · `renderPrint`) draws every piece as SVG — the gallery, the photos and
  the Save file are the same drawing. Every letter is **outlined** from TTFs bundled in `public/print-fonts/` (the
  faces and weights each look names; OFL, `LICENSES.md`), so a print shop needs no fonts and librsvg never draws a blank
  `<text>`. The QR is the app's `qrcode` library at level H, dark on a white plate, every ornament masked out of the
  piece's keep-out zone. The big pieces' badges are the shipped pill (`badgePill`, newly exported from
  `lib/shop-badge-print.ts`).
- **Save** = a print-ready file per piece: exact size in millimetres + 3 mm bleed, the calling card's front and back
  in one file — through the shipped `SaveFileLink` (`/api/vendor/prints?…&save=1`, the badge print route's pattern).
  Nothing is stored (each file is drawn on request), so there is no export to sweep.
- **Facts are read, never typed** (`lib/supplier-prints-shop.ts`): the name; the shop's own services as the trade line
  (tagline when it lists none; nothing when neither); `shopInitials`; `setnayan.com/v/<slug>`; the Verified seal,
  rating and badges from `readShopBadgeFacts` at print time. The QR address comes from the helpers the Promote codes
  use (`checkADateUrl` · `buildVendorInviteUrl` · `myPageUrl`).
- The data tables (`lib/supplier-prints.ts`) are the prototype's PIECES / DESIGNS / QR / PLACEMENTS, copied.
- `next.config.ts`: the print faces are traced into the one route that draws (`/api/vendor/prints`), not every lambda.
- Lab: `/dev/supplier-plan-lab?s=prints` (`&long=1` · `&noaddress=1`) mounts the real section on a fixture shop.
- Guards: `lib/supplier-prints-decode.test.ts` (every printed QR — 15 looks × 7 sides, all 3 codes, the Save files —
  rasterised and scanned back to the shop's real address with jsQR); `lib/supplier-prints.test.ts` (the 15 looks and 7
  pieces in the prototype's words, a Save file per piece at exact size + bleed with no `<text>`, facts not typed, one
  dropdown, nothing stored, every scene surface on its quad).

SPEC IMPACT: None — builds the approved prototype as specified (PLAN-FINISH-ALL-BUILDS-2026-11-05 Phase D item 10).
The Save file is a vector SVG (the shipped badge print's format), where the prototype's toast says "PDF" — flagged for
the owner in the PR.
