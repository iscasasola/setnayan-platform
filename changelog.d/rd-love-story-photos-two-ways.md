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
