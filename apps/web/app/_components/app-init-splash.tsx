'use client';

import { useEffect } from 'react';

/**
 * AppInitSplash — fades out the app cold-start ("initialization") splash.
 *
 * The splash markup + show-gate live in app/layout.tsx: an inline head script
 * sets `data-sn-boot` on <html> on the FIRST app-route (or native shell) load
 * of a session, and globals.css shows `#sn-init-splash` (the animated brand
 * mark on Warm Alabaster) while that attribute is present. This component runs
 * once hydrated and fades it away after a short hold.
 *
 * Surfaces (owner 2026-06-07 — "initialization loading", Both):
 *   · Web — first entry into the app (dashboard / vendor-dashboard / admin) per
 *     session. Marketing/legal pages are excluded by the gate, so SSR content +
 *     Lighthouse/LCP on the public site are untouched.
 *   · Native (Capacitor shell) — the static native OS splash bridges launch →
 *     WebView paint, NativeBridge hides it, then THIS animated splash shows the
 *     brand motion before the app appears. A slightly longer hold gives that
 *     handoff room.
 *
 * Robustness: globals.css also carries a CSS-only failsafe fade (~4s) so the
 * splash can never get stuck even if this never runs.
 */
export function AppInitSplash() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.hasAttribute('data-sn-boot')) return; // splash not active → no-op
    const el = document.getElementById('sn-init-splash');
    if (!el) return;

    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    const isNative = Boolean(cap?.isNativePlatform?.());
    // Native: give the native-splash → web-splash handoff an animated beat.
    // Web: a brief brand hold, then reveal the (already SSR-painted) app.
    const hold = isNative ? 750 : 450;

    let removeTimer: ReturnType<typeof setTimeout> | undefined;
    const fadeTimer = setTimeout(() => {
      el.classList.add('sn-boot-done'); // CSS fades opacity → 0
      removeTimer = setTimeout(() => {
        root.removeAttribute('data-sn-boot'); // fully out of the paint tree
      }, 500);
    }, hold);

    return () => {
      clearTimeout(fadeTimer);
      if (removeTimer) clearTimeout(removeTimer);
    };
  }, []);

  return null;
}
