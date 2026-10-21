/**
 * 🍎 MAY THIS SCREEN SELL THROUGH APPLE? — one pure rule, read by the server
 * (`getIapGate` in lib/request-platform.ts), which hands its answer to every Apple surface.
 *
 * All three must hold:
 *   1 · the STORE SHELL — the Capacitor app Apple reviews (lib/store-shell.ts).
 *       The web and the desktop app keep GCash / BDO and never see Apple.
 *   2 · a build that CARRIES THE STOREKIT PLUGIN AND IS VERSION 1.1 OR LATER —
 *       it appends `SetnayanIAP/2` (or higher) to its user-agent
 *       (apps/mobile/capacitor.config.ts, iOS only). An older binary has no
 *       plugin: showing it a buy button would be a door with nothing behind it,
 *       the same reasoning as `SetnayanSignIn/1` (lib/oauth-shell-gate.ts).
 *       ⚠ 1.0 (build 5) DOES carry the plugin and announces `SetnayanIAP/1` —
 *       but it was reviewed and submitted as an app that sells nothing, so the
 *       owner ruled (2026-10-21) that `/1` NEVER opens Apple, whatever the
 *       switch says. Only `/2`+ (1.1, the build In-App Purchase is submitted
 *       with) does. Build 5 is already built; its token cannot change.
 *   3 · the owner's switch `NEXT_PUBLIC_APPLE_IAP_ENABLED` (lib/apple-iap-flag.ts).
 *
 * Any one missing → false, and the store shell hides every paid item exactly as
 * it did before this build.
 */

/** The user-agent token the iOS build that sells through Apple (1.1+) appends. */
export const NATIVE_STORE_UA_MARKER = 'SetnayanIAP/2';

/**
 * Does this user-agent belong to a phone build that may sell through Apple — `SetnayanIAP/2` or higher? 1.0 (build 5)
 * announces `/1` and must never (owner 2026-10-21). One regex, no parse: the link guard runs it on the Maker's first
 * load, which sits at its byte budget. `/2`–`/9`, then any two-or-more-digit version (`/10`…); never `/0`, `/1`, `/1.5`.
 */
export function hasNativeStore(ua: string | null | undefined): boolean {
  return /\bSetnayanIAP\/(?:[2-9]|[1-9]\d)/.test(ua ?? '');
}

export function iapAvailable(input: {
  storeShell: boolean;
  userAgent: string | null | undefined;
  enabled: boolean;
}): boolean {
  return input.enabled && input.storeShell && hasNativeStore(input.userAgent);
}
