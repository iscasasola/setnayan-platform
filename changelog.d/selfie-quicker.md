## 2026-10-30 · fix(face+papic): a bigger selfie oval; no selfie saved that cannot be matched; the first photo stops waiting for a download; one 9:16 frame; the camera is exactly the screen

Owner, 30 Oct: *"take selfie face circle is too small and registering the selfie is taking too long to register … almost
2 minutes"* · *"sending photos after taking picture takes so long"*.

- **The oval** on the take-a-selfie screen grows from 58% of the width (at most 13.5rem) to 78% (at most 18rem).
- **The models load while the guest reads, not on the press.** The face detector (MediaPipe, from Google's model
  store) and, on a mode_a event, face-api.js with ~12 MB of weights used to start downloading only when "Take selfie"
  was pressed — so the guest stood in the oval while they arrived. They now start when the screen opens
  (`warmFaceGate` · `warmFaceEmbed`, the same cached promise the press uses). Fetching a model reads no face; the camera
  still starts only after the tick.
- **The press works on a smaller copy** — at most 720 px on its long side (was the full 1280 frame): the check and the
  face reading run in a fraction of the time on a phone, and the upload is a fraction of the size.
- **The Papic guest and seat cameras** load face-api while they open on a mode_a event. Each photo's face pass runs in
  the upload queue before the photo counts as ready, and the first one used to wait for the same ~12 MB download.

- **A selfie that cannot be read is never saved** (owner 2026-10-30, *"the photo ice casasola took should have been
  indalecia casasola when she registered her tag"*). Measured on cale-ice (read only): Indalecia's enrolment was saved
  with NO face vector, Indalecio's with one — so the event could match one face, and her photo was auto-tagged as him.
  On a mode_a event the selfie screen now reads the full camera frame once more when the small copy finds no face, and
  if there is still no fingerprint it stays on the screen with "Couldn't save — your face wasn't clear."; the server
  refuses the same (`face_unread`) BEFORE retiring the guest's previous enrolment, so a working one is never replaced
  by one that cannot match.
- **A face in the background no longer refuses a selfie** — only a second face at least 40% the size of the guest's
  ("two people in the oval") is "more than one face".
- **ONE FRAME: every Papic photo is 9:16 portrait, and the viewfinder shows exactly it** (owner, 30 Oct: *"we took a
  1:1 photo but it save a portrait photo"* → *"so viewfinder needs to be portrait"* → *"9:16"* — the 3:4 suggested on
  the way was overruled). `lib/papic-viewfinder-crop.ts` — `papicFrameCrop`: the centre 9:16 of the camera frame (the
  camera is asked for 16:9, so on most phones that is the whole sensor frame; a 3:4-only camera loses its sides), the
  digital 2× inside it. Both cameras draw the picture in a 9:16 box (`object-cover`, as large as the screen allows), so
  the box IS the photo. A phone held sideways delivers a landscape frame; the shipped camera always kept the
  orientation the phone delivered, so it still does — the same frame turned, 16:9. There was no aspect picker to
  remove (the ⊞ is the composition grid and stays). Clips are NOT cropped (that means re-encoding on the phone): they
  record the camera frame — 9:16 on most phones — and Snippet / a recording show that whole frame inside the box.
- **The camera page is exactly the screen** (owner, 30 Oct: *"also the camera page should be scroll free full screen
  camera page that works on browser and app."*). Both cameras (`/papic/guest`, `/papic/seat/[token]`) are a fixed
  stage the browser sizes (`fixed inset-0`, `h-[100dvh]`), the document is held still behind it with the one page lock
  every sheet uses (`CameraPageLock` → `lib/overlay-lock.ts`: body pinned, `overscroll-behavior: none`), released on
  leave. The picture is edge to edge; the slim top row (✕ · Ready · credits) and the controls lie OVER it, on a scrim,
  inside the safe areas (`env(safe-area-inset-top/bottom)`); the tools on the picture keep between the two (measured).
- **Nothing overlaps.** The floating "Add credits" sat ON the consent line (owner's iPhone): the consent is now a compact
  toggle on the bottom row, left — "Feature my clips" + ⓘ, still off by default, same meaning — stopping 10rem short of
  the corner "Add credits" sits in; that button is now 44 px tall. The long "Tap for a photo · press and hold…" line is
  in an ⓘ beside Photo ⇄ Snippet; while recording or tagging the live line still shows, ABOVE the controls, so the
  shutter never moves under the thumb. The seat camera keeps its last row clear for the same button.
- **No "Open in the Setnayan app" banner on the camera.** It is Safari's Universal Links banner (there is no
  `apple-itunes-app` meta in the app): `/papic/*` is claimed in `apple-app-site-association`. The two camera pages are
  now excluded (`NOT /papic/guest`, `NOT /papic/guest/*`, `NOT /papic/seat/*`, before the claim); every other
  `/papic/*` link still opens the app. iOS re-reads the file on app install/update or Apple's CDN refresh — not on
  deploy.
- ⚠ **Behind the fixed camera, nothing is reachable.** The guest page's "write a column" card (flag-gated:
  `GUEST_COLUMNS_ENABLED` + the `guest_columns` control) and the seat page's Camera Bridge panel (dark: `?bridge=demo`
  or its env flag) render in flow BELOW the camera. With the owner's "nothing below the fold" they cannot be scrolled to;
  neither is on by default as far as this session can read (server env is not readable) — they need a home in the
  camera if switched on. Flagged, not moved.

- **A failed save never costs the guest the fingerprint she had.** The unique index forces retire-then-insert; the
  retired rows are now remembered and put back when the new one does not land (it used to leave her with none).
- **A reader that never downloaded is "connection lost", not "your face wasn't clear"** — a failed face-api.js / weight
  download is told apart from a photo with no readable face, and the full-frame re-read is skipped (it would only wait
  for the same download again).
- **Tap-to-focus in Snippet** maps through `object-contain` (the whole frame now shown there); a tap on the bars
  focuses nothing.

Guards: `app/[slug]/_components/the-selfie-is-quick.test.ts` (sabotages seen red) ·
`app/papic/the-camera-is-the-whole-screen.test.ts` (4 sabotages seen red: lock dropped, stage reverted, hint back,
consent clearance removed) · `lib/papic-viewfinder-crop.test.ts` (executed: 9:16 · 3:4 sensor · sideways · 2× · every
frame stays inside, centred, 9:16) · `lib/papic-camera-steps.test.ts` (contain-fit tap) ·
`lib/a-tapped-tag-opens-the-app.test.ts` (the camera exclusions, and their order). Lab: `/dev/papic-camera-lab?lane=seat`
and `&buy=1` (the real Add credits doorway).

Not changed: the photo already tagged as Indalecio on cale-ice stays as it is (production data is not touched from a
session) — the host can remove that tag; Indalecia needs to take her selfie again for her photos to find her.

Not measured on a real phone from here — the slowness was read from the code path (what downloads on the press), not
timed. Other time after the shot (sending the full-size original over cellular) is unchanged.

SPEC IMPACT: `DECISION_LOG.md` — one row: the Papic photo is 9:16 portrait and the viewfinder shows exactly it (owner's "9:16"), and the camera page is scroll-free full screen. No schema · no SKU · no price.
