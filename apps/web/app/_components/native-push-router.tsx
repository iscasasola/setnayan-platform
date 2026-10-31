'use client';

import { useEffect } from 'react';
import { nativePushAvailable, onNativePushTap, refreshNativePushToken } from '@/lib/native-push';

/**
 * 📱 INSIDE THE IPHONE APP: a tapped notification opens its own screen, and an
 * already-allowed phone keeps its APNs token fresh (owner 2026-10-31 — replies
 * reach the phone). Mounted once in the root layout; a no-op everywhere else
 * (`nativePushAvailable()` is false on the web, in a PWA, on desktop, and in an
 * app build without the push plugin). It never asks for permission — the
 * one-time ask on Guests does that.
 */
export function NativePushRouter() {
  useEffect(() => {
    if (!nativePushAvailable()) return;
    let stop: () => void = () => {};
    let gone = false;
    void onNativePushTap((path) => window.location.assign(path)).then((s) => {
      if (gone) s();
      else stop = s;
    });
    void refreshNativePushToken();
    return () => {
      gone = true;
      stop();
    };
  }, []);
  return null;
}
