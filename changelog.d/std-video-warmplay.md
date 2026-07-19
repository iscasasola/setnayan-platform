## 2026-06-21 · fix(std): Save-the-Date clip audio auto-crossfades — "warm play" the clip from the lift

Follow-up to #1955: the owner reported the video audio still didn't auto-crossfade on iPhone. Root cause: the prior fix primed the `<video>` with an unmuted play→**pause** on first touch, but once paused, the clip's beat ~30s later needed a fresh unmuted `play()`, which iOS blocks outside a tap. (The soundtrack `<audio>` works precisely because it runs *continuously* from that same gesture.)

Fix — make the clip behave like the music (`apps/web/app/[slug]/_components/save-the-date-film.tsx`):

- **Warm play.** On the guest's first touch the `<video>` now starts playing and is **left playing** — unmuted, volume 0 (silent), `loop=true`, still invisible (`opacity-0` + `pointer-events-none` off-beat). A media element kept running from a user gesture retains its audio rights, so on the clip's beat we only **ramp its volume up** (the existing crossfade) instead of a fresh, iOS-blocked `play()`/unmute.
- **Keep it warm until its beat.** The video-beat effect's off-beat branch no longer always pauses the clip — it pauses only once we're *past* the beat (or sound is off). Before the beat it stays warm.
- **`loop=false` on the beat** so the clip plays once to its real end and `'ended'` advances the film (it loops only while warm so it never ends+pauses early).

Three guards (from the adversarial review) keep it safe:

- **`onEnded` is beat-guarded** (`if (idxRef.current === videoSlideIdxRef.current)`, mirroring `onError`) so a clip that ends while playing off-beat after a scrub can't yank the film forward from a text beat.
- **The warm-unlock skips an already-on-beat clip** (`idxRef.current !== videoSlideIdxRef.current`) so a first touch landing during the video beat (no-reveal grace path) can't set `loop=true` on it and hang the `dur:Infinity` beat.
- **Off-beat re-warm**: if a mute or backward-scrub left the clip paused before its beat, the off-beat branch restarts it silent+looping so its audio is ready to ramp (best-effort; iOS off-gesture rejects → the tap fallback still holds).

Graceful fallback intact: if iOS refuses to keep the clip warm (e.g. Low Power Mode pauses background video), the beat's `play()` is a fresh one → rejects → the existing muted + "Tap for sound" path runs, no hang. So warm-play is strictly an improvement — auto where the phone allows, the same one-tap otherwise.

**Smoother video↔website dissolve** (owner 2026-06-21 "can the crossfade be smoother between the video and the website?"). One shared `VIDEO_FADE_MS = 850` now drives both halves, up from an unsynced 700ms audio / 500ms visual:

- **Audio crossfade is now equal-power** (fade-out follows `cos`, fade-in `sin`; `cos²+sin²=1`) instead of a linear amplitude ramp, so perceived loudness stays constant through the dissolve — no mid-crossfade dip — and the ramp eases in/out instead of starting/stopping abruptly. Direction-aware so it's correct on entry (music→clip) and exit (clip→music).
- **The full-screen clip overlay's opacity fade is eased + synced** to the same 850ms (`transition-opacity ease-in-out`), so picture and sound dissolve together rather than on two different clocks.

Verified: `tsc --noEmit` exit 0; two adversarial multi-agent review rounds (lifecycle · anti-hang · artifacts, then fixes-resolve · new-bugs) clean. CI (lint + build) + Vercel preview are the gate; auto-crossfade is owner-verified on-device (not headlessly testable). ⚠ Best-effort on iOS — Low Power Mode can still force the tap (owner chose this trade-off 2026-06-21).

SPEC IMPACT: iter 0024 Save-the-Date — clip audio model (warm-play for gesture-free crossfade; "Tap for sound" remains the fallback). → DECISION_LOG row.
