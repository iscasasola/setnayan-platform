## 2026-08-09 · fix(live-studio): the host is told when a camera is dropped for exceeding the channel limit

When a host goes live with more camera channels than the Setnayan pool channel can carry,
provisioning refused the extras and counted them — and then threw the number away. The only
caller discarded the whole provisioning result, so the host saw a plain green success. A camera
operator with a printed QR code could turn up on the wedding day and simply never appear on air,
with nothing anywhere saying why.

The count is now a plain-English sentence carried out on the go-live result and shown on both
screens that have a "Go live" button — the Live Studio setup card and the controller's transport
row: *"2 of your 6 cameras are not being broadcast — this channel carries 4 cameras at a time.
Turn off the cameras you don't need, then go live again."* It renders as a warning
(`role="status"`), not an error: the broadcast really did go out, so there is nothing to retry.

- `lib/live-studio-roam-provision.ts` — new pure `cameraDropNotice()`; `ProvisionResult` now
  carries `notice: string | null` (null on every failure path).
- `app/dashboard/[eventId]/studio/panood/setup/actions.ts` — `goLivePanood` binds the provisioning
  result instead of discarding it and returns the notice; `GoLiveResult` success gains an optional
  `notice`.
- `app/dashboard/[eventId]/studio/panood/setup/go-live-card.tsx` ·
  `app/panood/control/[eventId]/transport-row.tsx` — render it, using each screen's existing
  banner pattern. No new notification mechanism.
- `lib/live-studio-camera-drop-notice.test.ts` — 10 tests following the value along the whole path
  to a human eye (sentence → result → action → both screens). Deliberately NOT an assertion that
  the count is computed: computed-and-discarded was the bug. Source assertions run over
  comment-stripped code so the paragraphs explaining the bug cannot satisfy them. All 8 mutations
  (drop the notice in the lib · make the sentence always null · discard the provisioning result
  again · strip it off the success · stop painting it on either screen · stop reading it on either
  screen) turn the suite red.

SPEC IMPACT: None — no product, pricing or scope change; a count that already existed is now shown.
