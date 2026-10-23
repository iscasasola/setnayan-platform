## 2026-10-23 · feat(papic): save first, send later — the bytes go straight to storage (strategy B)

**The fault, measured in production by the controller:** `POST /api/papic/guest-capture`
with a 6 MB body answered `413 FUNCTION_PAYLOAD_TOO_LARGE` from Vercel before our code ran
(Vercel functions refuse request bodies over 4.5 MB). A 10-second guest clip is designed at
~12.5 MB, so every normal clip failed; the supplier lane (`/api/vendor/papic-capture`, clips up
to 25 MB) had the same shape. Production holds 0 Papic captures, so no customer met it yet.

**Now (owner 2026-10-23: "each phone can shoot continuously while uploading online works on the
background"; relay: "as realtime as possible", "clean and safe"):**

- The shutter saves the shot on the phone (IndexedDB `papic` store) and is free at once; the
  page's ONE uploader (`lib/papic-upload/`) sends it — two pieces at a time, woken by a shot,
  `online`, the page becoming visible and page open; exponential back-off with jitter; Screen
  Wake Lock while anything waits; `navigator.storage.persist()`. The sync daemon leaves these
  items alone (no second sender).
- Each shot goes up in pieces, smallest first across the WHOLE queue: thumbnail (phone-made,
  320 px) → tile + display (640 / 1280 px) → the original only when the event keeps full-res,
  Wi-Fi preferred. Clips: poster → ~0.5 MB web copy → raw only when the event keeps full-res
  (or when no web copy could be made). The server's own derivation stays the fallback.
- Both capture routes take JSON only (`sign` · `record` · `attach`); a multipart body is refused
  (`415 bytes_not_accepted`). `sign` checks session/terms/window/put-away/credits, then presigns
  ONE staging key bound to the shot's clientCaptureId + tier, Content-Type and Content-Length
  signed, 5 minutes. `record`/`attach` read what landed, check size + magic bytes, screen stills,
  and write the checked bytes to a FINAL key no presigned URL can reach before any row points
  at it. Idempotent end to end by clientCaptureId (a replayed record answers `duplicate`).
- Credits: the reservation model was NOT built (it would change pool rules — owner: "don't
  guess" on money). The server checks at `sign` and charges at `record` with the existing RPC; a
  shot refused for credits stays on the phone and the chip says "Credits ran out · N not sent".
- Status chip (corpus 0012 offline note §6, house words): "All saved" · "Offline · N waiting" ·
  "Sending N of M" · "Credits ran out · N not sent" · "N not saved", details in ⓘ.
- Clean and safe: host Memories, the account library, the zip, save-photo, the magazine and the
  public teaser now allowlist `moderation_state = 'clean'` (they let `unscreened` through); Drive
  receives only screened shots; Guard A — the full-res drop never "replaces" an original that IS
  the display/thumb/tile copy. Unrecorded uploads are swept after the phone's 7-day TTL + 1 day
  (`lib/papic-upload-sweep.ts`, staging keys only, through the pinned cleanup executor).
- The Kwento decorator uses the same uploader (it also posted multipart to the capture route).
- Migration `20271285508020_papic_bytes_go_straight_to_storage`: `papic_upload_intents`
  (service-role only) + `vendor_papic_captures.client_capture_id` (unique per supplier).

Guards: `lib/papic-upload/no-capture-route-takes-file-bytes.test.ts`,
`lib/papic-upload/nothing-unscreened-reaches-another-person.test.ts`, the replayer scenario
suite `lib/papic-upload/replayer.test.ts` (10 photos + 2 clips offline → reconnect → each lands
once), plus Guard A / sweep / daemon tests — each sabotaged red and restored green.

Not in this PR: strategy C (the native iPhone background uploader, 1.1) — it plugs into
`lib/papic-upload/transport.ts`; the SEAT camera (already PUTs direct to R2 via `/api/upload`, so
no 413; moving it onto this uploader needs `papic_photos.client_capture_id`); the supplier
portfolio import (`/api/vendor/papic-portfolio-import`) still takes its file through the function.

SPEC IMPACT: `DECISION_LOG.md` row "23 Oct: Papic save first, send later (B); native background
upload (C) in 1.1; clips were blocked by the 4.5 MB function cap" (corpus
`~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`).
