## 2026-10-27 · fix(app): every download saves the file instead of trapping the iPhone app on it

Owner, 27 Oct (screenshot from the iPhone app): *"download excel on the app when pressed opened the file with no close
button and it did not download"* · *"shouldn't it try to open to if they have an app to open it. or save it?"* · then:
fold every other download with the same trap into the same fix.

The app's web view ignores `<a download>` and RENDERS a file in its only view — no back, no close, nothing saved. Swept
every screen a couple, guest or supplier can reach (~30 links in 32 files). Three mechanisms, one per kind of file:

- **`SaveFileLink`** (`app/_components/save-file-link.tsx`) — our own routes, static files, `data:` URIs: Guests ⤓ Excel,
  calendar `.ics` (event card, budget, appointments, save-the-date + film, supplier dates/clients), Budget CSV, profile
  data export, import templates, Papic gallery zip + Save photo, "Download my photos", guest code/pass saves,
  pabuya + payment QR saves, tag list CSV, blog PDF. Now runs `usePrintSave` (the Prints save): fetch with the session
  → the phone's share sheet (Save to Files / Save Image / open in another app) → a download on a computer; "tap again"
  for a file that outlived the tap; a failure in words (the old helper failed silently). Takes plain children, so a
  server page can mount it.
- **`OpenFileLink`** (new, `app/_components/open-file-link.tsx`) — presigned R2 files that are viewed: contracts
  (couple + supplier), chat attachments, memories, the teaser's and reel's saved copies. In the app: the in-app browser
  sheet (Done + Share); the web is unchanged.
- **`saveFileToDevice`** (new, `lib/save-to-device.ts`) — files made in the page: mood-board PDFs, emcee script,
  thank-you video, reels, teaser preview, Papic demo photo, monogram SVG/PNG. Share sheet on a phone, download on a
  computer, keeps the exact file name; "Tap to save" when the tap expired.
- Memories › Download all no longer `location.assign`s the zip; it saves it, with a "Preparing your photos…" line.

Guards:
- NEW `lib/a-file-download-never-traps-the-app.test.ts` — sweeps every app screen (admin + dev labs skipped) for a
  `<a download>` whose tap is not taken over, a plain link at a file route, and a page-made download with no share
  path. Sabotage: the Excel button without `preventDefault` → red; the event card's calendar back to a bare link → red.
  One named exception: Budget › "Print budget" opens an HTML print PAGE, not a file — how it should open in the app is
  an open owner question.
- `a-qr-download-never-opens-a-new-page.test.ts`: "server components never mount SaveFileLink" narrowed to the real
  hazard — a FUNCTION child from a server file (plain children now cross fine). Sabotage: a server page with a function
  child → red.
- Re-aimed (they pinned the bare link — the bug): `guest-export-file.test.ts` 6, `every-qr-surface-can-be-kept` (keepers),
  `the-film-monogram-fits-the-screen` C7 (the chip may now be a SaveFileLink).
- `lib/ugat/screens.generated.json` regenerated (`pnpm ugat:screens`).

Not verified on a real iPhone (the app loads production only). A very large Papic zip is now loaded into memory before
the share sheet opens — slow or failing on a huge gallery, but a failure is said in words.

SPEC IMPACT: None
