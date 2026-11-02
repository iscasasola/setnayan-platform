## 2026-06-22 · feat(std): the content film is now PURE auto-play + press-to-pause — drag-to-scrub removed

Owner directive (standing): *"remove the next slide to advance. tap just pauses. releasing will continue."* Scroll-scrub was removed earlier (#1983); this removes the **last** manual-advance gesture — the vertical **drag-to-scrub** — so the film's only interaction is **press to pause / release to continue**.

- `save-the-date-film.tsx`: deleted the swipe-detection block in `onPointerUp` (the `dx`/`dy` computation + `stepBeat` early-return), the now-unused `stepBeat()` function, the `REREAD_DWELL_BONUS_MS` const, and the `downXRef`/`downYRef` refs (+ their write in `onPointerDown`). Refreshed the header/interaction/chrome comments and two warm-play comments that still referenced scrub.
- **Kept intact:** auto-play (RAF loop), press-pause / release-resume on both text and video beats, the fullscreen request + petal-poke + audio-unlock on press, the veil, the petals, the warm-play audio crossfade, and the mute button.

So a guest can press-and-hold to linger on a beat, but the film never jumps between beats — it just plays through, edge to edge. (Easily reversible if a deliberate drag-scrub is wanted back.)

Verified: `tsc --noEmit` exit 0; orphan grep (stepBeat / REREAD_DWELL_BONUS_MS / downXRef / downYRef) = 0; focused adversarial review (gesture-model integrity + dead-code/regressions). CI lint + Vercel preview are the gate; on-device feel owner-verified.

SPEC IMPACT: iter 0024 Save-the-Date — the content film is auto-play + press-to-pause only; no scrub (scroll or drag). The corpus "scrubbable" descriptor is superseded. → DECISION_LOG row.
