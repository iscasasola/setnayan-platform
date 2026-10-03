## 2026-10-03 · feat(kwento): a scrapbook page — several Papic photos, people cut out as stickers, paper, tape and words

The one-photo Kwento Decorator grows into a page maker. Owner, 2026-10-03: *"it can
compile multiple photos with background and/or lift subject, to create a cool
scrapbook like collage"*, then **option A** (unlimited pages, downloading one is free,
a page saved to the gallery counts like one photo) and **"both get it"** (guests and
the couple).

- **Guests:** "Make a scrapbook page" on their My Photos page →
  `/papic/me/[token]/session?next=scrapbook` → `/papic/decorate?make=scrapbook`
  (same door, same gates as "Decorate a photo"). The tray holds the photos they are
  tagged in, read by `readGuestScrapbookPhotos` in `lib/guest-stories.ts` — the
  reel's own reader and **the same blur gate**, at display size instead of the
  320 px thumb. Saving posts to `/api/papic/guest-capture`, exactly what the
  one-photo decorator posts, so the credit, the per-guest ceiling, the safety
  screen, the wall and the Drive copy all apply unchanged.
- **Couple:** "Make a scrapbook page" above the gallery in the Papic studio →
  `/dashboard/[eventId]/studio/papic/scrapbook`. The tray is the whole gallery at
  lightbox size. Saving goes through the couple's UPLOADS camera
  (`/api/upload` + `recordSeatCapture`), exactly what "Add to your library" does —
  one Papic credit per saved page. With uploads off or unclaimed the page still
  works and says why it cannot save, and where to fix it.
- **Drag onto the bin to delete** (owner, 2026-10-03: *"in instagram and other editors.
  there is a trashcan on bottom center of the screen · drag it there to delete"*). While
  a layer is dragged a bin rises at the bottom centre of the page; over it, the bin turns
  red and the layer fades; letting go deletes it (Undo brings it back). The Remove button
  stays for anyone who cannot drag. `overBin` in `scrapbook-layout.ts`, tested.
- **The cut-out** runs ON THE PHONE: MediaPipe's Interactive Segmenter, from the
  same package and the same two hosts face matching already loads (so the CSP
  already names both — `the-csp-names-what-face-matching-loads.test.ts` now reads
  `lib/scrapbook/scrapbook-cutout.ts` too). Tap a person or draw a line down them;
  tap more people for a group. ~17 MB on first use, never on page load. No server
  render, no per-cut cost.
- **Honest reads:** `readTaggedPhotos` now THROWS on a refused query (the reel's
  caller already turned any throw into its empty plan, so the reel is unchanged);
  the scrapbook says "we couldn't load them" instead of "you're in none". The
  couple page probes the two tables before calling an empty gallery empty.
- **Same doors, by guard:** the couple's save is the fourth capture recorder
  `the-uploads-switch-is-real.test.ts` counts — registered there with why it
  answers for the OFF copy (it saves through the Uploads seat token, so
  `papicManualUploadsClosed` runs in both `/api/upload` and `recordSeatCapture`).
  `lib/papic-seat-upload.ts` is the presign+PUT the scrapbook uses; "Add to your
  library" keeps its own copy because `an-upload-is-a-capture.test.ts` pins that
  file's shape.
- New: `lib/scrapbook/` (layout + tests, draw, cut-out, save),
  `app/_components/scrapbook/scrapbook-maker.tsx`, `lib/papic-uploads-camera.ts`.

Checked in a headless Chromium through the real component (on the demo wedding's
photos, via a local harness that is not committed): four photos pinned on open, the
cut-out (~0.7 s), adding it to the page, and the finished image. NOT yet seen on a real
phone or against production Papic photos (whether R2 serves them to the canvas is the
first thing to look at), and neither save path has been exercised against a real event.

SPEC IMPACT: Owner ruling 2026-10-03 (scrapbook page, option A, guests and couple) needs a
corpus `DECISION_LOG.md` row; the corpus is not mounted in this cloud session, so it is
flagged in the PR rather than applied. "Kwento" keeps its name — the button says "Make a
scrapbook page"; whether Kwento itself is renamed under the 2026-09-29 naming rule is open.
