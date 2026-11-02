## 2026-10-19 · fix(apple): an iPad is an Apple device — Sign in with Apple, no NFC writing, no "macOS"

iPad + Duo audit batch B1 (W1 · W6 · W8; W9 measured and found already fine).

Measured on the iPad Pro 11-inch simulator (iPadOS 26.5): iPad Safari and the
Setnayan iPad app both send a `Macintosh` user-agent with no "iPad" in it
(the app: `… Mobile/15E148 SetnayanApp SetnayanSignIn/1 SetnayanIAP/1`), with
`maxTouchPoints` 5. Every `/iPhone|iPad|iPod/` read them as a Mac.

- **W1 (P0, App Store 4.8):** "Save to my account" in the iPad app offered
  Google with no Sign in with Apple. `saveMethodFor` now asks
  `isAppleTouchDevice` (new `lib/apple-device.ts`), which reads the app's bare
  `SetnayanApp` marker on a Macintosh UA as an iPad — the same rule as
  `isStoreShellSignals`. iPad Safari, which no server can tell from a Mac, gets
  the Apple block drawn beside the Mac one and swapped in after mount by
  `AppleOnTouch` (`maxTouchPoints > 1`).
- **W6 (App Store 2.1):** the iPad app offered "Write to NFC" (and the desk a
  tag tap) because the plugin is in every build. Both now ask the plugin's own
  `isSupported` (`nativeNfcWithHardware`, falling back to `getStatus` NO_NFC)
  and hide when there is no radio; iPad Safari is a `tablet` and hides too.
- **W8:** the Download overlay called iPad Safari — and every iPhone ("like Mac
  OS X") — "macOS" and lit up the .dmg. It now names the device and highlights
  no desktop download for a phone or tablet.
- **W9 — not changed:** WebKit has no `navigator.deviceMemory` (measured absent
  in iPad Safari and the iPad app), so `warmCanvasBudget`'s phone flag never
  zeroes the budget there; the iPad already warms the next stage.
- The two other iPad checks (`save-the-date-film.tsx`, `app-install-banner.tsx`),
  `home-screen-shortcut.ts`, `guest-landing.ts` and `guest-pass-hop.ts` read the
  device through the same helper. Guard: `apps/web/lib/apple-device.test.ts`
  (no other source file spells a device name in a regex).

SPEC IMPACT: None
