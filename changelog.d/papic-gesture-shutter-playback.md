## 2026-06-26 · feat(papic): gesture shutter (tap=photo / hold=record) + playable gallery clips + printable crew-QR pack

Second batch of Papic capture follow-ups (after #2280's instant shutter / countdown
/ roll / opt-in sync). Three owner-reported issues:

- **Gesture shutter restored.** Replaced the Photo/Clip *mode toggle* on BOTH
  capture surfaces (seat `papic-seat-capture.tsx` + guest `papic-guest-capture.tsx`)
  with a single shutter: **tap = photo, press-and-hold = record** (up to the 5s hard
  cap; release stops). Pointer-capture so edge-taps / finger-drift don't strand a
  press; haptic on record-start; `touchAction`/user-select/contextmenu guards kill
  the iOS long-press selection; a visually-hidden Take-photo / Record-clip pair
  keeps it keyboard/AT-reachable. Guest camera now acquires audio unconditionally
  (with fallback) so a hold-clip has sound. **NOTE:** this reverses the iteration
  spec's locked *drag-gesture* shutter (tap / drag-up / drag-right) and its retired
  tap-and-hold — owner-directed 2026-06-26; logged in DECISION_LOG.

- **Gallery clips are playable.** Clips showed a poster + play badge but the data
  layer only ever presigned the poster, so tapping did nothing. Added `playUrl`
  (presigned video at `r2_object_key`, clips only) to `papic-gallery.ts` and a
  tap-to-play **lightbox** in `papic-gallery-grid.tsx` (`<video controls autoPlay
  loop>` via the shared `useModalA11y`). New `saveMediaToDevice()` in
  `save-to-device.ts` (fetch→blob→download, content-type-derived extension) powers a
  working "Download clip" — the prior `<a download>` was cross-origin (browser-
  ignored → opened instead of saved) and hardcoded `.mp4` for `.webm` clips.

- **Crew QR is printable.** Each crew seat already showed an on-screen QR, but the
  studio page's "printable QR codes per seat" promise had no print surface. Added
  `crew/print` — an A4 pack of scannable seat-claim cards — and a "Print QR cards"
  button on the crew page.

Adversarial review (multi-agent) caught + fixed 3 bugs pre-merge: a guest stranded-
recording race (poster grab awaited before the recorder started), a rapid-re-press
drop (handlers gated on the lagging React `recording` state → now a synchronous
`recordingRef`), and the cross-origin download link above.

Verified: web typecheck + lint clean, production `next build` green
(`/papic/seat/[token]`, `/papic/guest`, `crew/print` all compile). Camera capture is
hardware-bound — needs an owner phone pass.

SPEC IMPACT: Reverses the 0012_papic gesture-shutter lock (drag-gesture → tap/long-
press) per owner direction 2026-06-26. Logged at the bottom of the corpus
DECISION_LOG.md. No schema / SKU / pricing change.
