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
- Keep full-res = `events.papic_quality_tier = 'full_res'` OR the HIGH_RES_ARCHIVE SKU active
  (`lib/papic-upload-keep.server.ts`). (The SKU has zero catalogue rows as of 2026-09-22.)

## State
- [ ] pure tiers + schedule modules + tests
- [ ] migration (upload intents + vendor client_capture_id)
- [ ] server sign/verify/attach/sweep
- [ ] guest route → JSON ops
- [ ] vendor route → JSON ops
- [ ] client engine + chip, wired into guest camera + vendor controller
- [ ] full-res drop: never drop when r2_object_key is the display copy (Guard A)
- [ ] host Memories readers → 'clean' allowlist
- [ ] guards (no bytes through capture routes · presign shape · safety a) + sabotage
- [ ] lab walk (WebKit + Chromium), shutter timing, screenshots
- [ ] seat lane (direct-to-R2 already; convert if budget allows)
