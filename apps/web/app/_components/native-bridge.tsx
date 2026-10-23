'use client';

import { useEffect } from 'react';
import { appUrlToPath } from '@/lib/app-url-path';

/**
 * Wires the Capacitor native shell (iteration 0052) to the hosted web app.
 *
 * We read the runtime-injected `window.Capacitor` global rather than importing
 * the `@capacitor/*` JS packages, so `apps/web` ships ZERO native dependencies
 * and ZERO extra bundle weight for web/PWA users — the native plugins only
 * exist inside the shell, and `isNativePlatform()` is false everywhere else, so
 * every effect below is a no-op outside the app.
 *
 * NOTE: compile/type-verified; the native paths are NOT yet runtime-tested on a
 * device/emulator. Validate BACK navigation, splash timing, and status-bar
 * insets on a real device before store submission.
 */

type BackButtonEvent = { canGoBack: boolean };
type ListenerHandle = { remove: () => void };

type AppPlugin = {
  addListener: (
    event: 'backButton' | 'appUrlOpen',
    cb: (data: BackButtonEvent & { url?: string }) => void,
  ) => Promise<ListenerHandle>;
  exitApp: () => Promise<void>;
};
type SplashScreenPlugin = { hide: (opts?: { fadeOutDuration?: number }) => Promise<void> };
type StatusBarPlugin = {
  setOverlaysWebView: (opts: { overlay: boolean }) => Promise<void>;
  /** Capacitor's `Style`: 'DARK' = light text (for a dark page), 'LIGHT' = dark text (for a light page). */
  setStyle?: (opts: { style: 'DARK' | 'LIGHT' }) => Promise<void>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: {
    App?: AppPlugin;
    SplashScreen?: SplashScreenPlugin;
    StatusBar?: StatusBarPlugin;
  };
};

/**
 * 🌗 The status-bar style for the page's theme, now and on every change of `html.dark` — 'DARK'
 * (light text) on a dark page, 'LIGHT' (dark text) on a light one. Asks only when it flips. Returns
 * the stop. Exported for `the-clock-follows-the-theme.test.ts`, which drives it with a fake root.
 */
export function clockFollowsTheme(
  root: { classList: { contains: (c: string) => boolean } },
  setStyle: (style: 'DARK' | 'LIGHT') => void,
  Observer: typeof MutationObserver = MutationObserver,
): () => void {
  let barDark: boolean | null = null;
  const paint = () => {
    const dark = root.classList.contains('dark');
    if (dark === barDark) return;
    barDark = dark;
    setStyle(dark ? 'DARK' : 'LIGHT');
  };
  paint();
  const watch = new Observer(paint);
  watch.observe(root as unknown as Node, { attributes: true, attributeFilter: ['class'] });
  return () => watch.disconnect();
}

export function NativeBridge() {
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
    if (!cap?.isNativePlatform?.()) return; // web / PWA / desktop → no-op

    const { App, SplashScreen, StatusBar } = cap.Plugins ?? {};
    const swallow = () => undefined;
    let backHandle: ListenerHandle | undefined;
    let urlHandle: ListenerHandle | undefined;

    // Capacitor's NATIVE bridge returns a listener handle SYNCHRONOUSLY — it is
    // NOT a Promise. Chaining `.then()` straight onto `addListener(...)` throws
    // "addListener(...).then is not a function" on a real device, which crashes
    // the whole app to the root error boundary on first launch. Normalize every
    // bridge call through `Promise.resolve` so it behaves whether the call
    // returns a Promise (web/PWA) or a bare value (native).
    const track = (
      r: ListenerHandle | Promise<ListenerHandle> | undefined,
      assign: (h: ListenerHandle) => void,
    ) => {
      Promise.resolve(r)
        .then((h) => {
          if (h) assign(h);
        })
        .catch(swallow);
    };

    // 1. Hardware BACK button. Capacitor's BridgeActivity default calls
    //    finish() — which EXITS the app from any interior screen. Route it
    //    through the WebView history instead; only exit at the root.
    track(
      App?.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else void App.exitApp();
      }),
      (h) => {
        backHandle = h;
      },
    );

    // 2. Deep links (App Links / setnayan:// — locked linking contract). When a
    //    link opens the app, navigate the WebView to the target path. The shell
    //    already carries the Supabase session cookie, so SSO is preserved.
    track(
      App?.addListener('appUrlOpen', ({ url }) => {
        // https://www.setnayan.com/<path> → <path>; setnayan://<host>/<path> →
        // /<host>/<path> (lib/app-url-path). This is also how a Google sign-in
        // in the SYSTEM browser comes home on Android: setnayan://auth/callback
        // ?code=… → /auth/callback, which finishes the session in this web view
        // (lib/native-oauth.ts). A malformed deep link maps to null — ignored.
        const path = appUrlToPath(url);
        if (path && path !== window.location.pathname + window.location.search) {
          window.location.assign(path);
        }
      }),
      (h) => {
        urlHandle = h;
      },
    );

    // 3. Hide the native splash once the remote page has painted (this effect
    //    runs after first mount). launchAutoHide in capacitor.config.ts is the
    //    backstop if the page never loads (offline → MainActivity fallback).
    Promise.resolve(SplashScreen?.hide({ fadeOutDuration: 200 })).catch(swallow);

    // 4. Keep the WebView below the status bar so content isn't drawn under the
    //    notch / system clock. (The clock's colour follows the theme — step 5.)
    Promise.resolve(StatusBar?.setOverlaysWebView({ overlay: false })).catch(swallow);

    // 5. 🌗 The clock follows the screen's theme (dark B1, 2026-10-23). The host
    //    paints the strip behind the status bar in the PAGE's own colour
    //    (SideSafeAreaHost.swift follows the web view's underPageBackgroundColor),
    //    so the words must follow the page too: dark text on Light, light text on
    //    Dark. The page's theme IS `html.dark` — set before paint by the head
    //    script and on every navigation by the provider, only where `darkApplies`
    //    — so this watches that one class and never decides on its own. Without
    //    it the style stayed the OS default, which follows the PHONE: a phone in
    //    dark mode drew a white clock over the Light page. Web code only — the
    //    StatusBar plugin is already in the shipped app, so no store resubmission.
    const stopClock = clockFollowsTheme(document.documentElement, (style) => {
      Promise.resolve(StatusBar?.setStyle?.({ style })).catch(swallow);
    });

    return () => {
      backHandle?.remove();
      urlHandle?.remove();
      stopClock();
    };
  }, []);

  return null;
}
