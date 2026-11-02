## 2026-06-22 · fix(std): music fade-in works for ALL Save-the-Dates (no-video silence regression from #2087)

Adversarial verification of the iOS-fade design caught a regression in #2087: the 3s entrance fade-in (the music volume ramp) lived INSIDE the video effect, which early-returns at `if (videoSlideIndex < 0 || !v) return;`. So for a Save-the-Date with music but **no video** (music + photo-gallery, or music + text close — a common case), the soundtrack was primed to `volume = 0` (the warm-play prime) and **never ramped back up → silent on desktop**. (cale-ice has a video, so it was unaffected — but other couples weren't.)

**Fix:** move the entrance fade to a **dedicated effect keyed on `started`**, independent of the video beat, so it runs for every Save-the-Date:
- New `useEffect` on `[started, preview, muted]` ramps the music `volume 0→1` over 3s (eased) the moment the film starts, guarded once by `musicEnteredRef`.
- A `musicEnteringRef` flag is true during the 3s ramp; the video effect's `crossfade()` skips its music-volume write while it's set, so the two don't fight (the 850ms crossfade would otherwise collapse the 3s entrance).
- The video effect's off-beat branch no longer does the entrance (just the snappy `VIDEO_FADE_MS` resume after the clip).

Now: desktop/Android get the smooth 3s fade on **every** STD (video or not); no-video desktop music is audible again; iOS starts cleanly at the lift (volume is read-only there) and is never stuck silent (it ignores the volume-0 prime too). The clip-audio path (silenceWarmClip / #2085 takeover) is untouched.

**Also (decision, not shipped):** the iOS *gradual* fade via Web Audio is **NOT being shipped** — the multi-agent verification found `createMediaElementSource` on the cross-origin presigned-R2 music URL produces a **tainted, SILENT graph on WebKit with no exception to catch**, which would silence the just-fixed iOS autoplay. It requires Cloudflare R2 CORS headers (an owner infra action) + `crossOrigin="anonymous"` + runtime silence-detection before it'd be safe. Deferred pending that; iOS keeps the clean (non-gradual) start.

SPEC IMPACT: `0024_save_the_date/` — the STD music 3s entrance fade is video-independent (desktop/Android); iOS gradual fade deferred (needs R2 CORS). (Reference/history only.)
