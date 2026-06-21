## 2026-06-21 · feat(std): Save-the-Date film — single swipe-up cue + auto audio crossfade + scrubbing polish

Five owner-driven UX fixes to the auto-playing Save-the-Date content film (`apps/web/app/[slug]/_components/save-the-date-film.tsx`), found while the owner hand-tested their own live veil reveal (event `cale-ice`):

- **One swipe-up prompt, not two.** The film's "Swipe up to continue ↑" hint duplicated the veil's "Lift the veil ↑ / or double-tap to lift it for you" pill — both are swipe-up cues, and the veil pill is the only one that renders *above* the veil (the film layer sits beneath it, so its hint could never show pre-lift anyway). Deleted the film hint + the now-dead `advanced`/`markAdvanced` machinery it drove (also reverted an interim markAdvanced-on-reveal). The veil pill is the single cue.
- **Video audio auto-crossfades.** On iOS the couple's clip auto-played *muted* (the soundtrack kept playing over it) because the unmuted `<video>.play()` ~30s after the lift had no user-activation. The film already primes the `<audio>` on the guest's first touch; it now primes the `<video>` identically (unmuted, volume-0, invisible play→pause) so the beat's autoplay-with-sound succeeds and the song crossfades down to the clip on its own. "Tap for sound" remains the fallback.
- **Swipe keeps auto-play.** A vertical swipe / scroll-scrub no longer flips the film to manual (removed `setPlaying(false)` from `stepBeat` + the wheel handler) — it navigates and the film keeps auto-advancing. Pause stays on press-and-hold + video-tap.
- **One-time "press and hold to pause" cue.** With the swipe hint gone the film has no chrome, so a single hint fades in ~1.6s after the film starts and fades out by ~6.4s (never returns) to keep pausing discoverable.
- **Backward re-read dwell.** Swiping/scrolling *back* holds that beat ~4s longer (`REREAD_DWELL_BONUS_MS`) than the forward dwell, so a deliberate re-read isn't yanked forward.

`reveal-overlay.tsx` (the surviving veil pill) is unchanged.

Verified: `tsc --noEmit` exit 0; five adversarial multi-agent reviews (regression · faithfulness · autoplay-soundness · RAF/timer state · hold-hint/dwell) returned clean. CI (lint + production build) + Vercel preview are the gate; the audio/gesture/timing behaviour is owner-verified on-device (not headlessly testable).

SPEC IMPACT: iter 0024 Save-the-Date — reveal/film prompt model: ONE "Lift the veil" swipe-up cue (no on-film "swipe up to continue"); video audio auto-crossfades; swipe = navigate, hold = pause. → DECISION_LOG row.
