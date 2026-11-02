## 2026-07-22 · fix(papic-games): a Photo Challenge completes with a photo OR a video

Owner: a Photo Challenge should be either a photo or a video. The completion
already accepted both — a guest clip lands in `papic_guest_captures` (same table,
`media_type='clip'`) and `papic_complete_mission` never restricts the media type —
but the guest panel's copy said "Use my last **photo**", which is wrong when the
last shot was a held clip. This names the actual media. Flag-gated
(`NEXT_PUBLIC_PAPIC_GAMES_V1`). No migration, no completion-path change.

- **`papic-guest-capture.tsx`** — track `lastCaptureKind` (`'photo' | 'clip'`)
  alongside `lastCaptureId`, set on the photo path and the held-clip path
  (`onSavedCapture`, keyed off `openFlash`), and pass it to the panel.
- **`papic-challenge-panel.tsx`** — the button now reads "Use my last **photo**" /
  "…**video**" / "…shot" (before any capture); the intro + hints say "a photo or a
  short video."

SPEC IMPACT: None — corrects live copy to match the already-supported behaviour
(a challenge completes with either media). `tsc --noEmit` clean.
