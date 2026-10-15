## 2026-10-15 · feat(veil): a tap or a swipe up unveils · nothing behind the veil plays until it is opened · the unveil starts the music

Owner, verbatim: *"on the reveal. nothing behind it should be playing until we open the reveal. our only
reveal at the moment is veil. before we had double tap to unveil. now we make it simpler. Tap, swipe up to
unveil"* · *"when they unveil, the music starts playing upon tap"*.

- **Gestures** (`app/[slug]/_components/reveal/veil-reveal.tsx`): a single tap runs the same hands-free lift
  the double-tap used to (`startAuto`, the fabric still folds away); swipe up unchanged; the double-tap and the
  tap that batted a petal are retired. A tap on an already-lifted veil does nothing (swipe down re-covers). New
  `onUnveil` prop, called synchronously inside the tap's / swipe's `pointerup`. One instruction:
  "Tap or swipe up to unveil" (`VEIL_HINT`, `reveal-overlay.tsx`).
- **Nothing behind it plays** — ONE signal, `lib/hub-veil.ts`: `data-veiled` on `<html>`, set by an inline
  script `RevealMount` writes only where an opening is mounted (so it runs before the hero's `<video autoPlay>`
  parses), released by the unveil gesture or by the opening standing down (reduced motion, seen this visit,
  landed part-way down, no WebGL, a rigid opening's open). While set: one `globals.css` rule pauses every CSS
  animation outside the opening's box; the script holds every `<video>`/`<audio>` that starts and every Web
  Animation (the layered logo) and resumes exactly those; the countdown's tick waits (`useVeilHeld`). The film's
  own media (`data-veil-free`) and the song the guest taps are never held. Fail-visible: unclaimed for 12 s (the
  veil claims when its hit-zone arms), the hold lets go by itself. No opening → the script is never written.
- **Music on the unveil** (`background-music.tsx`): `play()` runs inside the gesture via a direct
  `onUnveil` callback (not a dispatched event — DECISION_LOG 2026-06-22); one `startSong` for the button and
  the unveil; a refusal keeps ▶ and "Tap for their song". The Save-the-Date film's music already started on
  `std-go-fullscreen`, which the tap now dispatches too.
- Guards: `the-veil-opens-on-a-tap.test.ts` (gestures, in-gesture order, the hold script executed on a
  stand-in DOM, failsafe, reduced motion, the players' reads), `reveal-mount.test.ts` (the hold is in the
  server HTML only with an opening), `the-music-button-has-three-designs.test.ts` (the unveil starts the song,
  never deferred). Each sabotaged red.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` (row 2026-10-15, the ruling + builder
calls) · `0024_save_the_date/0024_Veil_Reveal_Spec_2026-06-17.md` (superseded-in-part note: double-tap and
petal-tap retired).
