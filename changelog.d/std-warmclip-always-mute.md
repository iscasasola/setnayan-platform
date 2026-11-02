## 2026-06-22 · fix(std): warm Save-the-Date clip is now ALWAYS muted — kill the persistent "video music plays while the veil is up" leak

Owner reported (repeatedly, still unsolved after #2030/#2043/#2049): when the veil is up, the **video's music plays before the video beat**, layered under the website background music. The earlier fixes tried to silence the warm (pre-buffering, invisible) clip with `volume = 0`, muting only when a "write 0, read it back" probe said volume was uncontrollable (≈ iOS).

**Root cause of the residual leak:** that probe is unreliable. On iOS WebKit, setting `volume = 0` can **echo the value back** (the getter returns `0`, looking "controllable") while ignoring it for actual output — a false positive that left the warm clip **unmuted and audible** at full system volume under the soundtrack. So the iOS mute fallback never fired.

**Fix — make the silence bulletproof, no probing:**

- `silenceWarmClip()` now **ALWAYS** sets `muted = true` (with `volume = 0` as a belt). `muted` is the only silence honored on every platform incl. iOS, so the warm clip is never audible off its beat. It no longer depends on the volume read-back at all.
- New `isIOSWebKit()` detects iOS/iPadOS by **user-agent** (reliable) instead of the volume probe, and drives the on-beat audio path: iOS → keep the clip muted + surface "Tap for sound"; everywhere else → unmute + crossfade the clip's audio in when it actually shows.
- The off-beat branch re-asserts `muted = true` on every run, so an unmute left over from an on-beat "Tap for sound" can't replay audio on a later tap.

The clip is still kept warm-playing (muted) before its beat to buffer; the soundtrack continues to play (that's by design — "music auto-plays"). Only the clip's own audio is gated to its beat now.

Net: no platform plays the clip's audio before/with the soundtrack. (The 135 MB legacy clip on cale-ice still benefits from the auto-compression shipped in #2055 — re-uploading it makes it small, which also moots any muted-vs-buffering concern.)

⚠️ This is a **PWA** — the fix won't appear until the service worker picks up the new deploy (a hard reload / second load forces it).

No schema changes. No SKU changes. Client-only logic in `apps/web/app/[slug]/_components/save-the-date-film.tsx`.

SPEC IMPACT: `0024_save_the_date/` — the warm content-film clip is unconditionally muted off its beat (silence via `muted`, not `volume`); iOS detected by UA for the on-beat crossfade-vs-"Tap for sound" choice. (Reference/history only.)
