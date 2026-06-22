## 2026-06-22 · fix(std): kill the iOS "video + background music at once" overlap on the Save-the-Date veil lift

The Save-the-Date content film (`apps/web/app/[slug]/_components/save-the-date-film.tsx`) kept the couple's keepsake clip playing **warm** before its beat — unmuted at `volume = 0`, looping, invisible — so its audio could ramp in via the crossfade on the beat without a fresh (iOS-blocked) `play()`/unmute. That warm-play silencing assumed `volume = 0` actually silences the clip.

It does on desktop/Android. But **iOS Safari treats `HTMLMediaElement.volume` as read-only** (system volume is the only control): the write is ignored and the getter keeps returning 1. So on iPhone the warm, invisible clip played at **full volume under the soundtrack** from the moment the veil lifted — the reported "once the veil goes up, both the video and background music play at the same time" on `setnayan.com/cale-ice`. The music-side ducking was unaffected because it silences by `pause()` (honored on iOS), not by volume; only the warm clip's volume-0 silencing was broken. Regression dates to the warm-play feature (commit `52ec8ef5`, 2026-06-21) — hence "not an issue before."

**Fix (iOS-gated; desktop/Android path unchanged):**

- New module helper `silenceWarmClip(v)` — sets `volume = 0`, reads it back; if the write didn't stick (iOS), falls back to `muted = true` (the only silence iOS honors). Returns whether the clip's volume is **controllable**, recorded in a new `videoVolCtlRef`.
- Both warm-play sites (the first-touch unlock effect + the off-beat re-warm) now route through `silenceWarmClip`, so the warm clip is **never audible** while invisible, on any platform.
- The video beat reads `videoVolCtlRef`: where volume is controllable it runs the existing smooth crossfade unchanged; where it is **not** (iOS) it plays the clip **muted**, keeps the soundtrack as the beat's audio (no dead air), and surfaces the existing **"Tap for sound"** control (a tap CAN unmute + duck via `enableVideoSound`). This restores the pre-warm-play iOS fallback that warm-play had silently defeated (the already-playing clip never rejected `play()`, so the catch-based fallback stopped firing).

Net: no platform ever plays the clip's audio and the soundtrack simultaneously. Desktop/Android keep the auto-crossfade; iOS gets muted clip + soundtrack + one-tap sound.

No schema changes. No SKU changes. Client-only logic in one component.

SPEC IMPACT: `0024_save_the_date/` — content-film audio behavior clarified: the keepsake clip's audio auto-crossfades only where the browser allows programmatic volume control (desktop/Android); iOS falls back to a muted clip under the soundtrack with a one-tap "Tap for sound". (Reference/history only — code is canonical per the 2026-06-07 ground-truth flip.)
