## 2026-11-01 · fix(hub-veil): a swipe up on the veil starts the couple's song in the app's Event Hub sheet

PR #7129 — owner: "the Event Hub does not play in the app". Measured in the iOS 27 simulator with the current
`apps/mobile` build, real injected touches, in BOTH the app's own WKWebView and the "View Event Hub" sheet
(SFSafariViewController, `openEventHub` → `@capacitor/browser`):

- **The cause found:** in the sheet (Safari's engine, Safari's media rules) a SWIPE UP's `pointerup` carries no
  media gesture credit — the song's `play()` there was refused with `NotAllowedError` (2 of 2), while a TAP's was
  allowed. The veil unveils on both, so a guest who swiped the veil up got a silent Event Hub. The app's own web view
  never showed it, because Capacitor lets media play with no gesture at all.
- **The fix:** the veil's `pointerdown` now runs `primeUnveilPress()` (`lib/hub-veil.ts`) first, and
  `BackgroundMusic` registers `primeMedia` on its `<audio>` — a `play()` + `pause()` in the press itself (silent),
  which unlocks the element so the swipe up's `play()` starts it (2 of 2 in the sheet with the unlock, 0 of 2 without).
- Held by `app/[slug]/_components/reveal/the-swipe-up-starts-the-song.test.ts` (sabotaged: 2 of 6 fail without the
  wiring).
- Measured working, no change: loop clips, tap-to-play clips full screen and in place, the music button tap — in
  both surfaces; scrub progress during an injected swipe — in the app's web view only. Not measured: scrub in the
  sheet, and the Maker's ▶ and hold-▶ (the lab server restarted under memory pressure on those loads). Needs a real
  iPhone: the silent switch and a real finger.
- Web-only; no new App Store build needed (the sheet and the app both load the web).

SPEC IMPACT: None

## 2026-11-01 · fix(hub-music): on an iPhone or iPad, the song's start says "No sound? Your phone may be on silent."

Owner's real iPhone on silent: the song started, the music button moved, nothing was heard. Ruling (DECISION_LOG
2026-11-01, "HUB SONG ON SILENT: RESPECT SILENT, SAY SO"): *"keep it silently playing but a message saying the audio is
playing but your phone is in silent/muted?"*

- The song keeps respecting the silent switch; nothing sets `navigator.audioSession`.
- `BackgroundMusic` reuses its own hint chip (the one that says "Tap for their song"): each time the song really
  starts (button or unveil, the one `startSong` path), on an iPhone or iPad only (`isAppleTouchDevice`, so an iPad
  that says "Macintosh" counts), it shows "Music is on. No sound? Your phone may be on silent." for 4 s, then fades
  (no fade under reduced motion). Stopping the song takes it away. Never on Android or a computer. "May": a web page
  cannot read the switch, and the hint never claims to.
- Held by `lib/hub-music-silent-hint.test.ts` (sabotaged 6 ways, each red).

SPEC IMPACT: None (the ruling is already in DECISION_LOG.md)
