# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-11 · feat(papic): multi-frame face tagging for clips (WS5)

Owner 2026-07-11 ("we want multi tagging"). A Papic clip is a moving scene — a guest can walk into shot at second 3 and never appear in the poster frame — so tagging only the poster missed people who are genuinely IN the clip. Clips now sample a handful of frames across the video, embed faces in each, and UNION the results, so everyone who appears anywhere in the clip is auto-tagged (subject to the same strict opt-in consent gate + ≤10-tag cap as photos).

- **`lib/face-embed-clip.ts`** — `pickClipSampleTimes()` (pure: ~1 interior frame/sec, capped at 6, edge-inset so no black first/last frame) + `unionClipFaceVectors()` (pure: greedy single-link clustering on the matcher's own Euclidean 0.50 same-person boundary → each person collapses to one representative, everyone included once) + `embedClipFaces()` (browser: decode → seek → draw → `embedFaces` per frame → union). Best-effort: dormant with no hosted model, and any decode/seek/embed error returns `[]` so it can never break capture.
- **Seat capture wiring** (`app/papic/seat/[token]/_components/papic-seat-capture.tsx`) — clips route through a new `autoTagFromClip` (multi-frame from the video blob); photos keep the single-frame `autoTagFromBlob`; a clip missing its video blob falls back to the poster. Same fire-and-forget, off-the-shutter contract.
- 11 new unit tests on the two pure functions; full suite 1438/1438, lint clean.

⚠ **Needs a device smoke-test before it goes fully live**: the frame-sampling loop is browser-hot-path (video decode + seek) that can't be exercised in unit tests — verify on a phone that recording a 5s clip with a late-arriving guest tags them. The guest-disposable capture component uses a different (pre-upload) embed pattern and is a separate follow-up.

SPEC IMPACT: None (completes the video half of the already-live face multi-tag; photo behavior unchanged).
