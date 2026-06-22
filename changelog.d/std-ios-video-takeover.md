## 2026-06-22 · fix(std): on iOS the clip's audio TAKES OVER at the video beat (no more "Tap for sound" / leftover music)

Owner on mobile (after #2077 made the background music auto-play on iOS): at the video beat it "still shows Tap for sound" and "the website sound stayed — it did not crossfade to each sound." That's the conservative iOS fallback I'd built: keep the clip MUTED + soundtrack playing + show "Tap for sound", because a fresh off-gesture unmute was assumed blocked.

But #2077 proved the opposite: an element kept **playing** from the lift gesture **can be unmuted off-gesture on iOS** (that's how the soundtrack now auto-plays). The clip is kept WARM (playing, muted) the same way — so it can be unmuted at its beat too, no tap required.

**Fix (iOS video-beat branch, `save-the-date-film.tsx`):** instead of muting the clip + surfacing "Tap for sound" + keeping the music, **unmute the warm clip** (`v.muted = false`) so its audio takes over, and **hard-duck the soundtrack** (`a.pause()` immediately — a volume ramp is a no-op on iOS where volume is read-only, and would leave both audible for ~700 ms). `setVideoSoundBlocked(false)` so the tap control no longer shows. The off-beat branch already resumes the music after the clip.

There's no SMOOTH (volume) crossfade on iOS — volume is system-controlled there, so it's an instant switch — but the clip's audio now **takes over automatically**, matching the owner-confirmed design (background music throughout → video sound takes over → music resumes). Desktop is unchanged (still the volume crossfade). The clip stays silent before its beat (silenceWarmClip / off-beat mute untouched). If warm-play never ran (no gesture), the desktop path's catch still surfaces "Tap for sound" as a genuine fallback.

⚠️ iOS-only behavior — owner to confirm on a real iPhone: at the video beat the music should stop and the clip's audio should play, with no "Tap for sound".

SPEC IMPACT: `0024_save_the_date/` — on iOS the keepsake clip's audio auto-takes-over at its beat (hard switch; smooth crossfade only where volume is controllable). (Reference/history only.)
