## 2026-09-28 · perf(prints): Prints & Tickets previews draw first-piece-first, cache by their inputs, and stop refetching on a size pick

Owner: the boarding-pass preview in Prints & Tickets took ~8 s. Measured on the
route: 0.8–1.0 s of server work per preview, `private, max-age=60`, every
preview requested at once, and every preview requested AGAIN on each size pick.

- **Versioned, immutable previews.** The Maker hashes everything a piece is
  drawn from — the event row and every read `loadPrintSet` makes (now ONE
  function, `readPrintSetInputs`, shared by the drawing and the hash), the QR
  look, the access (Pro / store shell) and the build — into `v`
  (`printInputsVersion` + `lib/print-preview-cache.ts`). A versioned on-screen
  answer is `private, max-age=31536000, immutable`; an unversioned one keeps
  the old 60 s. Any input change is a new address.
- **A piece's address carries its own size only.** Every preview used to carry
  all three families' sizes, so a pass-size pick changed all seven addresses.
  Now it changes the pass preview's and nothing else (the whole set still
  carries all three).
- **The first piece draws first.** The first preview asks at once with
  `fetchpriority="high"`; the rest wait until on screen AND the first has drawn
  (or 1.5 s). Once drawn, each piece warms its other sizes while idle, so a size
  pick finds its picture already cached.
- **A smaller screen SVG.** Measured locally, the photo was not the weight: the
  still is already a 420 px, q52 copy on screen (24.6 KB). About 73% of the
  boarding-pass SVG was outlined type. The Maker's on-screen SVG (only) now
  rounds path numbers to 0.1 pt and drops zero-length line segments on filled
  paths. Boarding pass: 169,366 → 128,005 bytes (brotli 57,839 → 48,711). The
  sample raster, the free thumbnails and the print PDF are untouched.

Guarded by `apps/web/lib/fast-print-previews.test.ts`.

SPEC IMPACT: None.
