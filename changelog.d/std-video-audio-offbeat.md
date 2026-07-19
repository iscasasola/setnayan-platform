## 2026-06-22 · fix(std): the Save-the-Date clip's audio can never play off its beat

Follow-up to the iOS veil double-audio fix (#2030). Owner reported on `/cale-ice`: "if I keep tapping the website it eventually plays the video music; it should only play when the video plays." The couple's keepsake clip is kept **warm** (playing, looping, invisible) before its beat so its audio can crossfade in on the beat. #2030 silenced the warm clip on iOS at the two known warm-play sites, but the clip is also left **unmuted** after an on-beat "Tap for sound", and warm-play kept it playing off-beat — so there were residual paths where the invisible clip could become audible while it wasn't the active beat.

Rather than chase each path, **enforce the invariant directly: off the video beat, the clip is always muted** — on every platform, on every effect run.

- `silenceWarmClip()` now ALWAYS sets `muted = true` (not just where `volume` is uncontrollable). The warm clip is silent on desktop/Android too — `volume = 0` is no longer relied on as the sole silence. It still detects + returns volume controllability so the video beat picks the smooth crossfade (desktop) vs the "Tap for sound" path (iOS).
- The video effect's **off-beat branch sets `v.muted = true` on every run.** The effect re-runs on every beat change AND every play/pause toggle (each tap), so any stray unmuted state — including the clip left unmuted by a prior "Tap for sound" — is corrected immediately. "Keep tapping" now keeps the clip *muted*, the opposite of the reported bug.
- The on-beat branch unmutes it again when the clip is actually showing (instant on desktop; iOS uses muted + "Tap for sound"), so the intended behavior is unchanged: the clip's audio plays only while the clip plays.

No schema changes. No SKU changes. Client-only logic in `apps/web/app/[slug]/_components/save-the-date-film.tsx`.

SPEC IMPACT: `0024_save_the_date/` — content-film audio invariant: the keepsake clip is audible only on its own beat; off-beat it is always muted. (Reference/history only — code is canonical per the 2026-06-07 ground-truth flip.)
