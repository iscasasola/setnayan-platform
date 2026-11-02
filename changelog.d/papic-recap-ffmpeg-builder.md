## 2026-06-28 · feat(papic): Auto-Recap 30s FFmpeg command builder (Group B prototype)

First buildable piece of the re-scoped render prototype (owner 2026-06-28:
"prototype Group B on Oracle Always-Free — ₱0, 30-second videos only").

- `apps/web/lib/render/recap-ffmpeg.ts` — PURE argv builder (no fs/spawn) for a
  ≤30s, 1080×1920 H.264 Auto-Recap montage: per-slot scale→cover-crop→fps
  normalize → `concat` → optional music bed (AAC + 1s fade-out) or silent.
  Array-form argv (no shell string → R2 paths can't inject). FFmpeg-only (no
  Remotion/Chromium) to stay light on the free ARM box.
- Hard 30s cap enforced (`RECAP_MAX_DURATION_MS`); throws on over-length /
  empty / non-positive specs.
- Unit tests (`recap-ffmpeg.test.ts`): concat shape + audio map/fade, silent
  path, 30s cap (incl. exactly-30s allowed), input validation. tsc 0, lint clean.

SPEC IMPACT: None on shipped product (unimported pure module — the Oracle worker
will spawn ffmpeg with this argv). Plan: `0012_papic/Render_Prototype_Oracle_30s_2026-06-28.md`.
Softens the Remotion+Lottie+LUTs lock to FFmpeg-first for the prototype (flagged
for owner sign-off). SDE remains retired (PR #2362).
