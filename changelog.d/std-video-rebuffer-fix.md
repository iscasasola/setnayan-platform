## 2026-06-22 · fix(std): stop muting the warm Save-the-Date clip — restore its pre-buffering (fixes today's stalling)

Regression from same-day #2043. Owner reported the Save-the-Date video on `/cale-ice` suddenly buffering — "5–10s before it plays, then pauses again and again" — when it had streamed fine the day before. The clip itself didn't change (45s, 135 MB, ~25 Mbps).

**Cause:** the film keeps the couple's clip playing **warm** (unmuted, `volume = 0`, looping, invisible) before its beat. That unmuted-volume-0 state is load-bearing for *playback*, not just audio: the browser treats an unmuted clip as active media and **buffers it ahead** during the ~30s of text beats, so a heavy clip is already buffered when its beat arrives. #2043 changed the warm clip to **always muted** (an over-zealous audio-leak guard) — and a muted background clip gets its buffering throttled/suspended, so the clip reached its beat unbuffered → long initial stall + repeated re-buffering pauses. (On a light clip this is invisible; on a 25 Mbps export it's fatal.)

**Fix:** silence the warm clip the way that *also keeps it buffering* — `volume = 0` while **unmuted** on desktop/Android (silent AND buffering), falling back to `muted` **only on iOS**, where `volume` is read-only and `0` doesn't silence. This restores the pre-#2043 behavior (#2030's design) for the warm path:

- `silenceWarmClip()` reverts to: unmute → write `volume = 0` → mute *only* if the write didn't stick (iOS). Comment now explicitly documents the buffering rationale so it isn't "always-muted" again.
- The off-beat branch no longer blanket-mutes the clip. Silencing off-beat is `volume = 0` (desktop, via `silenceWarmClip` + the `crossfade(1,0)`) / `muted` (iOS). The clip is hard-muted only in the **past-the-beat pause branch**, where it's done and buffering is moot — which also clears any unmute left over from an on-beat "Tap for sound" (so a later tap can't replay its audio).

Net: the heavy clip pre-buffers again (smooth playback restored), the iOS veil double-audio fix (#2030) is kept, and the clip is still silent off its beat (desktop volume 0 / iOS muted / paused after the beat).

(Separately: a 25 Mbps / 135 MB upload is heavier than ideal to stream; a couple's lighter 1080p export plays best. A size/bitrate guardrail on the Save-the-Date video upload is a recommended follow-up — not in this PR.)

No schema changes. No SKU changes. Client-only logic in `apps/web/app/[slug]/_components/save-the-date-film.tsx`.

SPEC IMPACT: `0024_save_the_date/` — the warm Save-the-Date clip is kept unmuted-at-volume-0 (not muted) on volume-controllable browsers so it pre-buffers; iOS-only falls back to muted. (Reference/history only.)
