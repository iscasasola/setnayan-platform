/**
 * 🍎 MAY THIS SCREEN SELL THROUGH APPLE? — one pure rule, read by the server
 * (`getIapGate` in lib/request-platform.ts) and the browser (`useIapShell`).
 *
 * All three must hold:
 *   1 · the STORE SHELL — the Capacitor app Apple reviews (lib/store-shell.ts).
 *       The web and the desktop app keep GCash / BDO and never see Apple.
 *   2 · a build that CARRIES THE STOREKIT PLUGIN — it appends `SetnayanIAP/1`
 *       to its user-agent (apps/mobile/capacitor.config.ts, iOS only). The
 *       binary already in people's hands has no plugin: showing it a buy
 *       button would be a door with nothing behind it, the same reasoning as
 *       `SetnayanSignIn/1` (lib/oauth-shell-gate.ts).
 *   3 · the owner's switch `NEXT_PUBLIC_APPLE_IAP_ENABLED` (lib/apple-iap-flag.ts).
 *
 * Any one missing → false, and the store shell hides every paid item exactly as
 * it did before this build.
 */

/** The user-agent token an iOS build with the StoreKit plugin appends. */
export const NATIVE_STORE_UA_MARKER = 'SetnayanIAP/1';

/** Does this user-agent belong to a phone build that carries the StoreKit plugin? */
export function hasNativeStore(ua: string | null | undefined): boolean {
  return /\bSetnayanIAP\/\d+/.test(ua ?? '');
}

export function iapAvailable(input: {
  storeShell: boolean;
  userAgent: string | null | undefined;
  enabled: boolean;
}): boolean {
  return input.enabled && input.storeShell && hasNativeStore(input.userAgent);
}
