'use client';

import { useEffect } from 'react';

type ClientType = 'tauri' | 'pwa' | 'web';

function detectClientType(): ClientType {
  if (typeof window === 'undefined') return 'web';

  // Tauri 2 desktop wrapper — exposes one of these globals or a UA marker.
  const tauriWindow = window as {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  if (
    typeof tauriWindow.__TAURI__ !== 'undefined' ||
    typeof tauriWindow.__TAURI_INTERNALS__ !== 'undefined' ||
    /Tauri/i.test(navigator.userAgent)
  ) {
    return 'tauri';
  }

  // Installed PWA — `standalone` on Android/desktop, `navigator.standalone`
  // on iOS Safari. `minimal-ui` covers a few edge configurations.
  const iosStandalone = (navigator as { standalone?: boolean }).standalone;
  if (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    iosStandalone === true
  ) {
    return 'pwa';
  }

  return 'web';
}

// Sets `setnayan-client-type` cookie so the auth middleware can apply
// 10-year cookie persistence + a more aggressive proactive-refresh window
// when the client is the desktop app or an installed PWA. Web stays at the
// 1-year baseline.
//
// The cookie itself is refreshed every 30 days — long enough to be sticky,
// short enough that a user who later uninstalls the PWA falls back to web
// behavior within a month.
export function ClientTypeDetector() {
  useEffect(() => {
    const type = detectClientType();
    const maxAge = 60 * 60 * 24 * 30;
    document.cookie = `setnayan-client-type=${type}; path=/; max-age=${maxAge}; samesite=lax`;
  }, []);
  return null;
}
