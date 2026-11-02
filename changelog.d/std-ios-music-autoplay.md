## 2026-06-22 · fix(std): background music auto-starts on mobile (iOS) at the veil lift, matching desktop

Owner: the Save-the-Date background music auto-played on desktop Safari but NOT on mobile (confirmed in a private/incognito tab, so it's real fresh-code behavior, not stale cache). Desired (owner-confirmed): background music plays from the lift through the text sequence on BOTH platforms; the clip's sound takes over only when the video plays.

An 8-agent trace + adversarial-verification workflow found the real mechanism (and killed a first synthesis that would NOT have worked on iOS — playing audio from a synthetically-dispatched `std-go-fullscreen` event does not carry iOS user-gesture activation, which the file's own comments already document):

- The soundtrack `<audio>` used the **pause-then-replay PRIME** (play → pause → rewind on the first touch, then a fresh `play()` at the lift). On iOS that replay is **blocked** — the *exact* lesson the warm CLIP already learned (its comment: "once paused, the beat needed a blocked re-play … so instead START it playing and LEAVE it playing"). The soundtrack was never updated to that pattern.
- The `<audio>` had **no `preload`**, so the in-gesture `play()` had to fetch first, and iOS drops the gesture credit when `play()` must buffer.

**Fix (apply the clip's proven pattern to the soundtrack):**
- `<audio>` gets `preload="auto"` and `muted={muted || !started}` — the track is kept **playing but MUTED** from the first touch (banking iOS audio credit), and becomes audible only when `started` flips true at the veil lift. An already-playing element can be unmuted off-gesture, which is how the music auto-starts on iOS where a fresh off-gesture `play()` is refused.
- The unlock effect now just **keeps the soundtrack playing** (muted via the attribute) instead of the pause→rewind prime.

`start()` already sets `started = true` at the lift, so the unmute is automatic; works for swipe-up AND double-tap (both have a native first-touch that starts the muted playback). The clip's own audio path (silenceWarmClip / off-beat mute) is untouched, so the "no video audio before its beat" fix does not regress.

⚠️ iOS autoplay/transient-activation behavior can ONLY be confirmed on a real device — owner to verify on a real iPhone (Safari + Chrome). Desktop is unchanged (already worked).

SPEC IMPACT: `0024_save_the_date/` — STD soundtrack uses the keep-playing-muted-then-unmute pattern (+ preload) so it auto-starts on iOS at the lift. (Reference/history only.)
