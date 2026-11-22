## 2026-11-22 · fix(papic): a host's live photo from the Event Hub camera costs the camera price; a file added by hand stays ×3

Owner, 22 Nov: "Make it 1." (specs DECISION_LOG "A HOST'S LIVE PHOTOS FROM THE EVENT HUB CAMERA COST 1×").

- **Where the ×3 was applied:** two seams, both asking `papicSeatCaptureSource(seat_index)` alone — the record
  (`recordSeatCapture`, `app/papic/actions.ts`) and the presign gate (`app/api/upload/route.ts`). Every capture on a
  host camera's seat was priced as "added by hand". That was true while the seat was only Memories' file picker; since
  the host's Event Hub camera opens the same seat (#8133) it charged a live shot ×3.
- **The split, made there:** `papicSeatCaptureSource(seatIndex, addedByHand)` — an upload only on a host camera's seat
  AND when the Add-photos door says so. Memories' "Add photos" sends it on the presign (`papicAdded`) and on the record
  (the new last argument); every camera lane (the seat camera, its offline drain, the camera bridge) sends nothing and
  pays the camera price. The rate is `papicCaptureCost` / `PAPIC_UPLOAD_MULTIPLIER` — no number typed.
- Guests are unchanged (their route's own `source: 'phone'`). No migration: the price is computed in the app and
  handed to `papic_record_seat_capture` as `p_cost`; no SQL prices by seat.
- ⚠ The "added by hand" word comes from the client, as the guest path's `source: 'phone'` does — the server cannot
  see whether a file was shot or picked. A tampered uploader could pay the camera price for a picked file (bounded at
  ×1, host seats only).
- Tests: new `lib/a-hosts-live-shot-costs-the-camera-price.test.ts`; `every-host-has-their-own-camera.test.ts` and
  `the-sheet-and-the-server-share-one-ladder.test.ts` updated on purpose.

SPEC IMPACT: None — implements the 22 Nov ruling already in DECISION_LOG.
