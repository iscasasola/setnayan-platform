## 2026-06-22 · fix(std): video crossfades in from frame 0 — no mid-clip flash before it plays

Owner: at the video beat there's ~1s where a MIDDLE frame of the clip shows, then it jumps and plays from the top. Cause (owner diagnosed it correctly): the clip is kept WARM — playing + looping while hidden — so it buffers ahead and (on iOS) retains the audio rights that let it be unmuted off-gesture. So when its beat arrives the clip sits at a random mid-clip position; the full-screen overlay fades in showing that frame, THEN `currentTime = 0` resets it → the visible mid-frame flash.

Fully pausing the warm clip (the owner's suggestion) would be cleaner visually but breaks the iOS audio takeover (#2085) + buffering (iOS needs the clip actively playing). So instead, keep it playing hidden but **don't reveal the overlay until the clip has SEEKED back to frame 0**:

- New `clipReady` state; the full-screen video overlay's opacity is now gated on `idx === videoSlideIndex && clipReady` (was just `idx === videoSlideIndex`).
- On entering the video beat: seek the warm clip to 0 and reveal (`clipReady=true`) only on its `'seeked'` event — so the crossfade shows **frame 0**, never a mid-clip frame. A 700ms fallback timer reveals anyway if `'seeked'` never fires (already-at-0 / not-seekable), so it can never get stuck hidden. The website/film stays visible through the brief (buffered → ~instant) seek, then the clip crossfades in from the top.

So the website-to-video transition is now a clean crossfade into the clip's first frame. Works on desktop + iOS; the clip's warm playback (iOS audio + buffering) is untouched.

SPEC IMPACT: `0024_save_the_date/` — the video beat reveals the clip only once it's seeked to frame 0 (no mid-clip flash); crossfade into frame 0. (Reference/history only.)
