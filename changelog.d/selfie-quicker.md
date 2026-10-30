## 2026-10-30 · fix(face): a bigger selfie oval; no selfie saved that cannot be matched; the first photo stops waiting for a download; a photo keeps the box shown

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
- **A photo keeps the box the viewfinder showed** (owner: *"i took a video and photo on a 1:1 screen but it save a
  portrait shot?"*). The viewfinder draws the camera `object-cover` into a near-square box, and the shutter kept the
  whole portrait frame. Both Papic cameras now keep exactly the region shown (`lib/papic-viewfinder-crop.ts`, with the
  digital 2× inside it). A clip records the whole frame, so Snippet and a recording hold now SHOW the whole frame
  (`object-contain`) — on screen is what is kept, both ways.

Guards: `app/[slug]/_components/the-selfie-is-quick.test.ts` (7 sabotages seen red) ·
`lib/papic-viewfinder-crop.test.ts` (executed).

Not changed: the photo already tagged as Indalecio on cale-ice stays as it is (production data is not touched from a
session) — the host can remove that tag; Indalecia needs to take her selfie again for her photos to find her.

Not measured on a real phone from here — the slowness was read from the code path (what downloads on the press), not
timed. Other time after the shot (sending the full-size original over cellular) is unchanged.

SPEC IMPACT: None.
