# HANDOVER — rd/papic-save-first-send-later (Papic "save first, send later", strategy B)

Builder: Opus · started 2026-10-23. Keep this file current; a stop at any moment must leave a clean state.

## Why
Measured (controller, prod, 2026-10-23): `POST /api/papic/guest-capture` with a 6 MB body →
`413 FUNCTION_PAYLOAD_TOO_LARGE` from Vercel before our code runs (cap 4.5 MB). Guest clips
(~12.5 MB designed) all fail. `/api/vendor/papic-capture` has the same shape (multipart bytes →
server `r2Upload`). The SEAT camera already PUTs direct to R2 via `/api/upload` presign (no 413).

## Owner rulings this build follows
- 2026-10-23: "each phone can shoot continuously while uploading online works on the background";
  priorities reliability, speed, ease. Strategy **B** (browser + base inside the iPhone app);
  **C** (native background URLSession uploader) = 1.1, NOT this PR — uploader sits behind one
  interface (`lib/papic-upload/transport.ts`) so C can plug in.
- Coordinator relay 2026-10-23 "as realtime as possible" + "clean and safe": tiers per shot,
  thumbnail → display → original (original only when the event keeps full-res, Wi-Fi preferred);
  clips poster → web copy → raw. Server derivation stays as the fallback. Nothing reaches another
  person before the NSFW screen passed. Presigned PUTs bound to one key (clientCaptureId + tier),
  short expiry, Content-Type + Content-Length signed. Record verifies existence, size, magic bytes.
  Unrecorded uploads are swept. Bucket stays private.
- Rule 0 sources: corpus `0012_papic/0012_papic_offline_note.md` §2 + §6 (capture queue + status
  words), `0012_papic/Papic_Storage_Sustainability_Spec_2026-07-22.md` Guard A / Guard B,
  `ROADMAP_TO_APPLE_CHECK_2026-10-06.md` (native background upload = after Apple = C).

## Design (decided)
- Shutter: frame → canvas → event look → JPEG (local encode only) → IndexedDB `papic` store →
  shutter free. Tiers (thumb 320 / tile 640 / display 1280, WebP where the browser encodes it,
  else JPEG) are made in a background prepare step from the saved blob.
- One page-side replayer (`lib/papic-upload/replayer.ts`), 2 PUTs in parallel, triggers: shot,
  `online`, `visibilitychange`→visible, page open. No service-worker replayer for these items:
  `lib/offline/sync-daemon.ts` skips them.
- Phases per capture: R (record) → A2 (attach) → A3 (attach original/raw). All R before any A2,
  all A2 before any A3 across the whole queue.
  - Photo: R = thumb → `record` (row born with r2_object_key = thumb, screened in after()).
    A2 = tile + display → `attach` (each screened BEFORE its key is written; r2_object_key moves to
    display). A3 = original (only when the event keeps full-res) → `attach` (screened; r2_object_key
    moves to the original).
  - Clip: prepare makes poster + web copy (ffmpeg.wasm, best-effort). R = poster + first playable
    (web copy, else raw) → `record`. A3 = raw when keep-full-res and a web copy exists.
- Credits: STOPPED the reservation model (it would change pool rules = money; owner "don't
  guess"). Server checks at `sign` (no charge) and charges at `record` with the existing RPC. A
  shot refused for credits stays queued and the chip says "Credits ran out · N not sent".
- Keep full-res: see "Decisions made here" below (`eventKeepsFullRes` in lib/papic-upload-intents.server.ts).
  (The HIGH_RES_ARCHIVE SKU has zero catalogue rows as of 2026-09-22.)

## State (2026-10-23, keep current)
- [x] pure tiers + schedule + replayer (+ scenario tests: 10 photos + 2 clips offline → reconnect → 12 rows, a lost answer replayed as duplicate)
- [x] migration 20271285508020 (papic_upload_intents + vendor client_capture_id) — NOT applied anywhere but the PGlite replay
- [x] server: lib/papic-upload-intents.server.ts (sign → staging key; load + check size/type/magic; screen; promote to the final key; settle) + sweep lib/papic-upload-sweep.ts (admin layout, daily)
- [x] guest + vendor routes → JSON ops sign · record · attach; multipart refused 415 bytes_not_accepted
- [x] client: lib/papic-upload/{store,prepare,transport,lanes,replayer,browser,ownership}.ts; chip app/papic/_components/upload-chip.tsx; guest camera + supplier camera + Kwento decorator wired; legacy guest/vendor drains removed (adopted on page open); sync daemon skips them
- [x] Guard A in the full-res drop; host readers → 'clean' allowlist; Drive only after the screen
- [x] guards + sabotage (S1–S10 all red → green, see below)
- [x] DECISION_LOG row + 0012 offline note status (corpus e4f6f9b9, pushed)
- [ ] full tsc / lint / unit / db (heavy lock) — then walk (WebKit + Chromium) — then PR
- [ ] seat lane — NOT in this PR (see "Left")

## Sabotage runs (break → red → restore → green), 2026-10-23
S1 multipart back in the guest route → no-bytes guard red · S2 attach writes before screening → safety guard red ·
S3 host Memories `!== 'nsfw_blocked'` → red · S4 a network failure drops the shot → replayer red (2) ·
S5 phase order swapped → replayer order red · S6 Guard A equality removed → drop-core red ·
S7 PUT TTL an hour → guard red · S8 a fresh id per retry → capture-id test red ·
S9 daemon sends save-first items → daemon test red · S10 sweep raw-deletes → sweep test red. All restored green.

## Decisions made here (owner may reverse)
- Keep full-res = `papic_quality_tier` in (full_res, optimal) OR HIGH_RES_ARCHIVE active (`eventKeepsFullRes`). The relay said
  "original only when Keep full-res is on"; no single switch exists, and 'optimal' promises A3 prints — dropping its original
  would make the picker's words false. One line to narrow.
- Credit reservation NOT built (money). Sign pre-checks, record charges (existing RPC). Credit refusals keep the shot queued.
- A row never points at a key a presigned URL can reach: the phone PUTs to `…/incoming/`, the server re-writes checked bytes
  to the final key (stills: the screened bytes themselves; videos: ETag-pinned copy).
- Record is screened synchronously (off the shutter path now); attach waits for the record's screen; Drive only gets 'clean'.
- Host Memories / library / zip / save-photo / magazine / teaser allowlist 'clean' (relay (a)). A classifier outage now
  HIDES from the couple until the re-screen sweep heals — and the phone keeps sending ("Sending …") until it does.

## Walk notes (lab: /dev/papic-camera-lab, scripts + shots in ~/Documents/Claude/Projects/shots-2026-10-23/papic-save-first/)
- serve: scripts/serve.sh (walk lane, port 3617, lab no-database env + 54321 stub); STOP by `touch scripts/STOP`.
- walk: `ENGINES=chromium|webkit node scripts/walk.mjs` (route-intercepted server + R2; 2 Mbps up, 150 ms RTT).
- Chromium (dev): shutter free 4–9 ms; on the phone ~0.8 s; 12 rows, 1 lost answer replayed as duplicate; 22 MB in 71 s.
- WebKit (dev) traps: (1) Playwright's setOffline makes WebKit unable to READ its own Blobs (NotReadableError) — the walk
  cuts the link at the network edge instead; (2) Safari ephemeral IndexedDB refuses Blob → store falls back to ArrayBuffer;
  (3) dev-mode JSC runs the look ~20× slower (ORIG 15.6 s → 7.2 s after the row-major blur) while a production-style
  bundle runs it in 255 ms (WebKit) / 310 ms (Chromium) — the dev number is not a phone number.
- NEVER edit apps/web while a walk runs: Fast Refresh reloads the lab and resets the page's uploader mid-walk.
- ⚠ Incident: I ran `pkill -f "node scripts/walk.mjs"` once (to stop my own walk) — a by-name kill that could have hit
  another session's same-named script. Disclosed in the report.

## Left (for the report)
- Seat camera onto the uploader: needs papic_photos.client_capture_id + idempotent recordSeatCapture + a seat sign op
  reusing /api/upload's seat gates. Seat bytes already go direct to R2 (no 413).
- /api/vendor/papic-portfolio-import still takes its file through the function (12 MB cap > 4.5 MB): same fault, not a camera.
- C (native iPhone background upload): register a transport via setPapicTransport (lib/papic-upload/transport.ts); the OS
  must also persist the queue across app kills (today the queue is IndexedDB in the WebView).
