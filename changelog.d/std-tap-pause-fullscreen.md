## 2026-06-21 · feat(std): press=pause / release=continue film gestures + clip fills the screen

Two owner-requested interaction changes to the Save-the-Date content film (`apps/web/app/[slug]/_components/save-the-date-film.tsx`).

**1. "remove the next slide to advance. tap just pauses. releasing will continue."** The gesture model is rewritten:
- **Press = pause, release = continue.** Removed the 240ms hold-timer (`holdRef`/`wasHoldRef`) — a press now pauses *immediately* and releasing resumes. A quick tap is a momentary pause (the paused span is credited back to the beat's dwell so it isn't cut short); a press-and-hold holds the beat as long as you like.
- **Removed the left/right-third tap-to-step** ("next slide to advance") entirely.
- A **vertical swipe still scrubs** to an adjacent beat (keeps auto-playing) — it overrides the press-pause.
- On the **video beat**, press pauses the clip and release resumes it (the film's hold is untouched). `onPointerCancel` now resumes too, so a lost pointer never strands the film paused. Taps on real controls (Tap-for-sound · Add-to-calendar · mute) still pass through (`hitControl`).

**2. "video must be full screen" → blurred fill.** The live full-screen clip overlay was `object-contain` (letterboxed on black). It now fills the viewport via a **blurred fill** (owner 2026-06-21 ruling — "place a blurred video to fill the black space" over cropping): the real clip plays `object-contain` (whole frame, **no crop**) over a scaled, blurred, muted copy of the *same* clip (`object-cover blur-2xl brightness-[0.6]`). So a portrait-screen + landscape-clip mismatch (or the reverse) reads as a soft cinematic fill instead of black bars, without cropping the couple. One rule covers both orientations. The backdrop is decorative + muted (autoplay-safe) and plays only on the beat (a small `videoBgRef` gate effect). The builder preview card is unchanged.

Verified: `tsc --noEmit` exit 0; adversarial review (gesture correctness · interaction regression) clean. CI (lint + build) + Vercel preview are the gate; gesture/timing is owner-verified on-device.

SPEC IMPACT: iter 0024 Save-the-Date film interaction — press=pause/release=continue, no tap-to-step, clip fills the screen (object-cover). → DECISION_LOG row.
