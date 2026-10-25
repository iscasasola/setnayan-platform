/**
 * location-ask.ts — THE ONLY DOOR TO THE DEVICE'S LOCATION.
 *
 * Owner, DECISION_LOG 2026-10-19 "FIVE CONTROLLER RECOMMENDATIONS APPROVED"
 * (1): THE IPHONE APP DECLARES NO LOCATION. The iOS Info.plist carries no
 * NSLocation* key (held by `the-app-declares-what-it-collects.test.ts`), and we
 * told App Store Connect "no location". Inside the app every screen that would
 * ask for location skips the ask; the web keeps asking.
 *
 * 🔑 WHY ONE DOOR. Before this file there were four separate
 * `navigator.geolocation` calls (onboarding "Near me", the Maker's city pick,
 * the open-shop "Use my location", Papic's geo-stamp). In the app each one
 * either did nothing (iOS refuses a WebView with no usage string) or, the day
 * someone adds the usage string, silently starts collecting location we told
 * Apple we do not collect. `lib/the-app-never-asks-for-location.test.ts` fails
 * if any file but this one touches the geolocation API, so a fifth call cannot
 * skip the gate.
 *
 * A CONTROL that asks (a "Near me" button) must also be HIDDEN in the app —
 * a button that does nothing is worse than no button. Each carries
 * `data-asks-location`, which app/globals.css hides under the
 * `html[data-store-shell]` mark set in <head> before the first paint
 * (lib/store-shell.ts `storeShellMarkScript`); this file only decides whether
 * the ask runs.
 *
 * Desktop (Tauri, `SetnayanApp/desktop`) is NOT the store shell and keeps
 * asking, like the web — `isStoreShellInBrowser` is the shared rule.
 */
import { isStoreShellInBrowser } from '@/lib/store-shell';

export type LocationFix = { lat: number; lon: number; accuracyM: number };

/**
 * May this page ask the device where it is? False inside the App Store /
 * Play Store shell, false where there is no geolocation API, true otherwise.
 */
export function mayAskForLocation(): boolean {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return false;
  if (!navigator.geolocation) return false;
  return !isStoreShellInBrowser(navigator.userAgent, document.cookie);
}

/**
 * One fix, for a control the person pressed. `onNoFix` runs when the ask is
 * skipped (store shell, no API) and when the person refuses or it times out —
 * every caller already treats those the same way (a fallback or nothing).
 */
export function askLocationOnce(
  onFix: (fix: LocationFix) => void,
  onNoFix: () => void,
  options?: PositionOptions,
): void {
  if (!mayAskForLocation()) {
    onNoFix();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (p) => onFix({ lat: p.coords.latitude, lon: p.coords.longitude, accuracyM: p.coords.accuracy }),
    () => onNoFix(),
    options,
  );
}

/**
 * A running watch (Papic's geo-stamp keeps the latest fix so the shutter never
 * waits on GPS). Returns the stop function; in the app it never starts and the
 * stop is a no-op, so each capture stamps `{ unavailable: true }`.
 */
export function watchLocation(onFix: (fix: LocationFix) => void, options?: PositionOptions): () => void {
  if (!mayAskForLocation()) return () => {};
  const id = navigator.geolocation.watchPosition(
    (p) => onFix({ lat: p.coords.latitude, lon: p.coords.longitude, accuracyM: p.coords.accuracy }),
    () => {
      // Denied / timeout / no signal — keep any last-known fix.
    },
    options,
  );
  return () => navigator.geolocation.clearWatch(id);
}
