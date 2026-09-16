## 2026-09-16 · feat(qr): the saved QR image carries the couple's monogram

Owner decision #19 (2026-09-16): the DOWNLOADED QR must carry the monogram, not
just the one on screen.

Until now the on-screen SVG carried the couple's mark and every saved PNG
dropped it. All three PNG routes recorded the same reason — "compositeMonogram
operates on raw SVG strings" — and called the bare file "the bulletproof
shareable version". The cause was a true statement about a function and a false
conclusion about the product: on this platform the saved picture IS the
invitation. Measured in production: of 77 guests on one live wedding, 75 have
neither an email address nor a mobile number, so nothing digital reaches them —
somebody prints the image or hands it over.

Changed:

- `lib/glyph-path.ts` (new) — string → SVG path outlines from a bundled TTF.
  Extracted unchanged from `lib/lockup-pdf.ts`, which now imports it, so the PDF
  lockup badge and the QR-centre raster badge cannot drift. The PDF's emitted
  path data is byte-identical to before the extraction.
- `lib/monogram.ts` — `monogramOverlaySvg` / `compositeMonogram` take an optional
  `renderText`. The geometry stays in ONE place; only how a run of type becomes
  markup is swappable. Every existing caller gets the same `<text>` badge as
  before.
- `lib/qr-monogram-raster.ts` (new) — composites that same badge onto a QR PNG,
  with every glyph as an opentype.js outline. Deliberately NOT a `<text>`
  rasterisation: this repo has already recorded that librsvg's fontconfig path
  is flaky on Vercel, which would draw a blank cream disc on a lambda while
  looking perfect locally.
- `lib/qr.ts` — `renderInvitationQrPng` takes an optional monogram;
  `renderEventLandingQrPng` + `renderBrandedInvitationQrPng` added so the two
  routes that built their PNG inline now share one url builder and one badge.
- `app/api/guest/qr/route.ts`, `app/api/website/qr/[slug]/route.ts`,
  `app/api/website/qr/guest/[guestId]/route.ts` — all three now pass the resolved
  monogram. A badge that cannot be drawn returns the plain QR and logs; it never
  costs the guest their code.
- `lib/the-saved-code-carries-the-mark.test.ts` (new) — asserts the mark is in the
  PIXELS (per-region deviation against a flat control, decoded raw) and that the
  composited PNG still decodes to the SAME url as the plain one.

SPEC IMPACT: `DECISION_LOG.md` owner decision #19 row (2026-09-16) — recorded.
