## 2026-06-22 · feat(std): 3-second fade-in for the Save-the-Date background music entrance

Owner: the background music should start only when the veil is up, with a **3-second fade-in** for a smooth entrance (instead of popping in at full volume).

Timing was already correct (the music is muted until `started` = the veil lift). This adds the gradual entrance:

- The crossfade helper gains a `durMs` parameter (default `VIDEO_FADE_MS`).
- The **first audible music rise** (the entrance, at the veil lift) now ramps over **3000 ms**, with the volume forced to 0 first so the ease-in starts clean; tracked by `musicEnteredRef` so it runs once. Later rises (music resuming after the clip) keep the snappy `VIDEO_FADE_MS`.
- The unlock primes the soundtrack at `volume = 0` so the lift unmute never pops before the fade.

⚠️ **Platform note:** the gradual fade works on **desktop/Android** (where `element.volume` is rampable). **iOS Safari locks `volume` to the hardware**, so on iPhone the music starts cleanly at the veil lift but without the gradual ramp. A true iOS fade requires routing the `<audio>` through a Web Audio `GainNode` (gain IS rampable on iOS) — deferred as a separate, more careful change since it risks silencing the music if the AudioContext mis-resumes, and the iOS autoplay only just started working (#2077).

No schema/SKU changes. Client-only.

SPEC IMPACT: `0024_save_the_date/` — the STD soundtrack eases in over 3s at the veil lift (desktop/Android; iOS clean-start pending a Web Audio fade). (Reference/history only.)
