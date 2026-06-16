'use client';

import { useEffect } from 'react';

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
type StatusBarPlugin = { setOverlaysWebView: (opts: { overlay: boolean }) => Promise<void> };

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: {
    App?: AppPlugin;
    SplashScreen?: SplashScreenPlugin;
    StatusBar?: StatusBarPlugin;
  };
};

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
        if (!url) return;
        try {
          const u = new URL(url);
          // https://www.setnayan.com/<path> → navigate to <path>.
          // setnayan://<host>/<path>      → treat host+path as the path.
          const path = u.protocol === 'https:' ? u.pathname + u.search : (u.host ? `/${u.host}` : '') + u.pathname + u.search;
          if (path && path !== window.location.pathname + window.location.search) {
            window.location.assign(path);
          }
        } catch {
          /* malformed deep link — ignore */
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
    //    notch / system clock. (Style/theme tinting is deferred — it depends on
    //    the active app theme and wants on-device tuning.)
    Promise.resolve(StatusBar?.setOverlaysWebView({ overlay: false })).catch(swallow);

    return () => {
      backHandle?.remove();
      urlHandle?.remove();
    };
  }, []);

  return null;
}
