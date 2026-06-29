## 2026-06-30 · feat(papic): Tier-2 subject_center producer — persist the dominant face center per guest capture

The PRODUCER half of Stories Tier-2 auto-reframe (so pan/zoom/orbit frames the subject, not the geometric center). Reuses the on-device face-api pass that already computes match descriptors — no extra model run, no server detection.

- `lib/face-embed.ts` `embedFaces` now returns `{ vectors, subjectCenter }` (was `number[][]`): `subjectCenter` is the normalized (0..1) center of the **largest** detected face. Both callers updated (`papic-guest-capture` uses both; `papic-seat-capture` destructures `vectors`).
- `papic-guest-capture.tsx` sends `subject_center_x/y` alongside the descriptors (online photo path).
- `api/papic/guest-capture` parses them defensively (rejects anything outside [0,1]) and persists on the capture row via an `UPDATE` keyed on the `captureId` it already resolves — no RPC signature change.
- Migration `20270325005061`: two nullable `REAL` columns `subject_center_x/y` on `papic_guest_captures`. Additive + idempotent.

**Forward-compatible / dormant until the CONSUMER lands (Vids AI lane):** nothing reads `subject_center_*` yet. `lib/guest-stories.ts` should map it onto the render's `source.subjectCenter` (reel-render already reads it). NULL (no face / model not hosted) → render keeps the centered default focal, so this never breaks a render. Offline-queued captures don't carry it yet (follow-up); seat captures (papic_photos) are a separate follow-up.

SPEC IMPACT: None — implements `0012_papic/Papic_Walkup_Face_Identity_Plan_2026-06-29.md` § 10 (1.5a). Migration applies via `supabase db push`.
