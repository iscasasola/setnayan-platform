## 2026-10-08 · fix(upload): a photo that did not upload says so — never a tile that spins for ever

Owner, testing Studio › Love Story's photo slots on the local copy: *"it does not
upload"*, with a picture of one tile stuck at "0%" beside a spinner. Reproduced
in headless Chromium on that copy: `POST /api/upload → 503`, and forty seconds
later the tile still read "0%" with its spinner, no line anywhere, and Done held
shut on "Uploading… 0%".

Two faults, both in the shared `FileUpload` (`app/_components/file-upload.tsx`):

- **In development only** (React's Strict Mode, which a local copy runs under):
  the uploader's "am I mounted" flag was cleared by the effect's rehearsal cleanup
  and never set again, so EVERY ending — a refusal, a stall, even a landing — was
  dropped. Production does not rehearse and was not affected. The flag is now set
  on mount.
- **Everywhere:** the signing request (`/api/upload`) had no clock; one that never
  answered spun for ever. It has one now (the same silence budget as the PUT).

The sign-then-PUT run moved, unchanged in what it sends, to `lib/upload-send.ts`
(`sendToStorage`): it settles EXACTLY ONCE with one of five answers — landed,
refused, network, stalled, stopped — and takes `fetch`, `XMLHttpRequest` and the
timers as arguments, so a test drives the real control flow (the runner has no
DOM). `FileUpload` loads it at the first upload (`await import`), so it and the
stall watchdog leave the first load of every page that merely shows an uploader.

New, optional, off for every existing caller:

- `failedSays="…"` (`gallery` only) — a file that did not upload stays as a tile
  that says those words, with **Try again** (the same file, through the pick's own
  door) and ✕. Nothing of it joins the value; `onBusy` goes false. A 4xx's own
  reason (too large, the allowance is full) is still shown; a 5xx's is the
  operator's and is not.
- `stallMs` — how long nothing may move before an upload is dead (default 45 s).
- `send` — a stand-in for storage, for the dev lab only.

Studio › Love Story's slots ask for it: the tile says "Couldn’t upload this
photo.", and a photo that moves nothing for 15 seconds is given up on.

**What changes for the other 50 screens that draw `FileUpload`** (no restyle):
on a local copy their uploads now end at all; a signing request that never
answers ends after 45 s with the line they already show for a stalled upload;
✕ pressed while a file is still being signed now really stops it (before, the
tile went but the file uploaded anyway and joined the value); a refusal whose
body is not JSON reads "Presign failed (502)" instead of a parser's error text.

Guard: `apps/web/lib/a-refused-upload-says-so.test.ts` (10 tests; 21 sabotages
seen red). `app/_components/file-upload-compress-first.test.ts` re-pointed at the
hand-off to the run (its `fetch('/api/upload'` anchor moved files).

SPEC IMPACT: None — builds `INTERACTION_RULES.md` § 5 ("Failure = the plain
reason + Try again, never looking like success") and § 9's upload ruling.

## 2026-10-08 · feat(lab): the dev lab can really add a photo to a Love Story moment

The lab (`/dev/maker-lab?studio=1`) is the owner's only way to see Studio › Love
Story, and it has no file storage — so there an upload could never succeed. The
lab now stands in for storage (`app/dev/details-lab/lab-upload-stand-in.ts`,
`sendToStorage`'s own shape), so the REAL uploader, slots and row run on a photo
he picks: its figure goes up, Done reads "Uploading… N%" and is held, it lands,
"Not kept yet — press Done." shows, and Done raises the square's count.

Exactly what the stand-in fakes: no request is made (nothing is signed or sent —
the file never leaves the browser); the photo is an object URL in the browser's
memory (a reload forgets it); the ref is made up; the figure is a timer (six
steps, under two seconds), not measured bytes; nothing is screened. A file whose
name starts `fail` is refused and one starting `stall` moves nothing, so the
failed tile can be looked at too. A change only the server may decide (a moment
with a NEW photo) is applied to the fixture in memory with the server's own
`applyMomentIntent`, through the instant book's own `editLoveStory`.

The seam: the Love Story slots read `SlotsUploadStandIn` (null everywhere a
person can reach → real storage) and hand it to `FileUpload`'s `send`. Only
`app/dev/` provides it; the lab route refuses production.

Also: the failed tile's ✕ is a 44 px round target in its corner (it was the
uploader's 24 px ✕, stretched into an oval by the app's button height floor).

Guard: `apps/web/lib/the-lab-can-upload.test.ts` (4 tests — the stand-in is RUN
with hand-turned timers; 14 sabotages seen red).

SPEC IMPACT: None.
