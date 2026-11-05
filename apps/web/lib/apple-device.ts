/**
 * lib/apple-device.ts — THE ONE PLACE A USER-AGENT IS READ FOR "WHICH DEVICE IS THIS".
 *
 * House rule (iPad + Duo audit, 2026-10-19): layout is chosen by WIDTH, and a
 * feature is offered by CAPABILITY (`NDEFReader`, the NFC plugin's own
 * `isSupported`, …) — never by sniffing a device name. The one exception is
 * Apple's own user-agent quirk, which no capability check can see past, and it
 * lives HERE, once, held by `lib/apple-device.test.ts`.
 *
 * 🍎 THE QUIRK, MEASURED (iPad Pro 11-inch simulator, iPadOS 26.5, 2026-10-19):
 *   · iPad Safari  → `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15
 *                     (KHTML, like Gecko) Version/26.5 Safari/605.1.15`, maxTouchPoints 5;
 *   · the iPad APP → `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15
 *                     (KHTML, like Gecko) Mobile/15E148 SetnayanApp SetnayanSignIn/1 SetnayanIAP/1`,
 *                     maxTouchPoints 5.
 * Neither says "iPad". A bare `/iPhone|iPad|iPod/` therefore reads both as a
 * Mac — which is how the iPad app's "Save to my account" offered Google with
 * no Sign in with Apple (App Store guideline 4.8), how the iPad app offered
 * "Write to NFC" on hardware with no NFC (2.1), and how the Download overlay
 * told an iPad "macOS". And `/mac/i` is worse still: it matches the iPhone's
 * own "like Mac OS X".
 *
 * TWO WAYS AN iPAD IS TOLD FROM A MAC, and only these two:
 *   1. In the browser — a `Macintosh` UA with more than one touch point. No Mac
 *      has a touch screen, so this is the iPad (pass `navigator.maxTouchPoints`).
 *   2. On the server — a `Macintosh` UA carrying the phone app's BARE
 *      `SetnayanApp` marker. That marker is appended only by the Capacitor
 *      shell (apps/mobile/capacitor.config.ts `appendUserAgent`); the desktop
 *      Tauri app sends `SetnayanApp/desktop`. It is the same rule
 *      `isStoreShellSignals` (lib/store-shell.ts) applies — spelled here, not
 *      imported, so a client chunk that asks "is this an iPad?" does not carry
 *      the store shell's route tables. `apple-device.test.ts` holds the two to
 *      the same answer. (A pre-2026-06 Tauri build sent the bare marker too; it
 *      reads as an iPad here, which can only ever offer it Sign in with Apple —
 *      a door that works on a Mac.)
 * iPad Safari is invisible to a SERVER (case 1 needs the browser). A server
 * decision that must be right there is corrected after mount by a client part
 * asking `isAppleTouchDevice(navigator.userAgent, navigator.maxTouchPoints)`
 * — see `AppleOnTouch` (app/[slug]/_components/apple-on-touch.tsx).
 *
 * Pure: no `navigator`, no `headers()` — callers pass what they read.
 */

export type DeviceOs = 'iphone' | 'ipad' | 'android' | 'mac' | 'windows' | 'desktop' | 'other';

/**
 * Which device a user-agent (plus, in a browser, its touch-point count) is.
 * `maxTouchPoints` is omitted on the server, where it cannot be known.
 */
export function deviceOs(userAgent: string | null | undefined, maxTouchPoints?: number | null): DeviceOs {
  const ua = userAgent ?? '';
  if (/iPad/i.test(ua)) return 'ipad';
  if (/iPhone|iPod/i.test(ua)) return 'iphone';
  if (/Android/i.test(ua)) return 'android';
  if (/Macintosh/i.test(ua)) {
    if ((maxTouchPoints ?? 0) > 1) return 'ipad';
    if (/SetnayanApp(?!\/desktop)/i.test(ua)) return 'ipad';
    return 'mac';
  }
  if (/Windows/i.test(ua)) return 'windows';
  if (/Linux|CrOS/i.test(ua)) return 'desktop';
  return 'other';
}

/** An iPhone, iPod or iPad — including an iPad whose user-agent says Macintosh. */
export function isAppleTouchDevice(userAgent: string | null | undefined, maxTouchPoints?: number | null): boolean {
  const os = deviceOs(userAgent, maxTouchPoints);
  return os === 'iphone' || os === 'ipad';
}

/**
 * True when a SERVER reading `userAgent` would call it a Mac but a browser could
 * still turn out to be an iPad (case 1 above): the cue for a server render to
 * let `AppleOnTouch` correct it after mount.
 */
export function mightBeIpadSafari(userAgent: string | null | undefined): boolean {
  return deviceOs(userAgent) === 'mac';
}
