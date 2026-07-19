## 2026-06-30 · feat(papic): Tier-2 auto-reframe — subject_center producer + consumer (full loop)

Stories Tier-2 auto-reframe end-to-end (so pan/zoom/orbit frames the detected face, not the geometric center). Reuses the on-device face-api pass that already computes match descriptors — no extra model run, no server detection.

- `lib/face-embed.ts` `embedFaces` now returns `{ vectors, subjectCenter }` (was `number[][]`): `subjectCenter` is the normalized (0..1) center of the **largest** detected face. Both callers updated (`papic-guest-capture` uses both; `papic-seat-capture` destructures `vectors`).
- `papic-guest-capture.tsx` sends `subject_center_x/y` alongside the descriptors (online photo path).
- `api/papic/guest-capture` parses them defensively (rejects anything outside [0,1]) and persists on the capture row via an `UPDATE` keyed on the `captureId` it already resolves — no RPC signature change.
- Migration `20270325005061`: two nullable `REAL` columns `subject_center_x/y` on `papic_guest_captures`. Additive + idempotent.

**Consumer (this PR too — conflict-checked, no Stories PRs in flight):** `lib/guest-stories.ts` reads `subject_center_x/y`, carries it on `StoryPhoto.subjectCenter`, and `guest-story-maker.tsx` passes it into the `RenderClip` (`reel-render` already reads `source.subjectCenter` via `resolveFocus`). NULL (no face / model not hosted) → render keeps its centered default focal, so it never breaks a render — and it upgrades the heuristic auto-reframe to a real-face one the moment the face model is hosted (PR #2429). Offline-queued captures + seat captures (`papic_photos`) don't carry it yet (follow-ups).

SPEC IMPACT: None — implements `0012_papic/Papic_Walkup_Face_Identity_Plan_2026-06-29.md` § 10 (1.5a). Migration applies via `supabase db push`.
