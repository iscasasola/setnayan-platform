## 2026-10-19 · fix(camera): every camera page reopens its camera when iOS or a Duo takes it

Duo + iPad audit 2026-10-19, row W4 (checklist point 9). No camera page
listened for the track ending or muting, or for the page coming back, so after
a trip to the home screen — or an iPhone Duo opening or closing — the preview
stayed frozen or black with no way back short of a reload. (Live Watch's camera
listened for `visibilitychange`, but only to re-send its heartbeat; it never
reopened the camera either.)

- `lib/camera-comes-back.ts` (framework-free) + `lib/use-camera-that-comes-back.ts`
  (the hook): while a page's camera is live it reopens it, once, through the
  page's own open path (same facing, same constraints, the page's shipped
  "starting the camera" state) when the page comes back from hidden, a video
  track ends, a track stays muted past 1.2 s, or the window turns / changes
  width by 25 % or more (a height-only change is a keyboard and is ignored).
  Never while hidden, never twice at once, never mid-take (held while a clip
  records or a take is reviewed/uploaded — a reopen is never a shot and never
  spends a credit), and never a tight loop (a camera that dies within 2 s of
  opening three times running waits up to 30 s; a camera that lived is never
  throttled).
- Wired into `usePapicCamera` (Papic guest, seat and supplier capture — each
  passes `holdRestart` so a clip is never cut), the Live Watch camera and its
  demo, the Patiktok booth and tag sheet, the check-in, souvenir and seat
  scanners, the guest selfie, Samahan stories and the Papic demo.
- Guard `lib/every-camera-comes-back.test.ts`: every file that calls
  `getUserMedia(` calls the hook or is exempt by name and reason (the
  throwaway light-check probe, the 1:1 call room, the DSLR bridge class), and
  every `usePapicCamera` call holds its reopen while recording. Unit tests
  `lib/camera-comes-back.test.ts` run the watch against a mocked MediaDevices.

SPEC IMPACT: None.
