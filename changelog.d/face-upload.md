## 2026-06-28 · feat(face): upload up to 3 photos for face enrollment (min 1)

Day-of face enrollment was live-camera only. Owner (2026-06-28): guests can
**upload up to 3 photos (minimum 1)** to power recognition, instead of having
to pose for selfies.

- `SelfieCapture` (multi-shot mode) now offers **Upload photos** alongside Take
  selfies — in the initial state and the angle gallery. Uploaded images run the
  SAME pipeline as a live frame (advisory face-gate → on-device embed → R2
  presign + PUT), capped at 3 total, and append to the same `shots[]` the
  enrollment submits. Min 1 already enforced (submit gates on ≥1 shot).
- Refactored the capture/upload shared work into `processCanvas()` (gate +
  embed + upload) so camera and upload reuse one path; new `fileToCanvas()`
  decodes + downscales an uploaded image (≤1280px) before processing.
- Single-shot (RSVP) path unchanged.

Still gated on the dormant on-device embedder (`lib/face-embed.ts`) for actual
auto-tagging — this just broadens the enrollment INPUT. Single skippable RA
10173 consent.

Follow-up (flagged, not in scope): mirror the up-to-3 upload at RSVP (needs a
small `submitRsvp` change to write multiple `guest_face_enrollments` rows).

SPEC IMPACT: Logged in `DECISION_LOG.md` (event-day hub program — face upload).
Iteration `0012` (guest face enrollments) / `0031_day_of_guest` reference homes.
