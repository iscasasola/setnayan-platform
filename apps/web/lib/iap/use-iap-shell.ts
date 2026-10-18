'use client';

import { useEffect, useState } from 'react';
import { isStoreShellInBrowser } from '@/lib/store-shell';
import { iapAvailable } from '@/lib/iap/iap-gate';
import { isAppleIapEnabled } from '@/lib/apple-iap-flag';

/**
 * The browser twin of `getIapGate()` (lib/request-platform.ts): may this screen
 * sell through Apple? Starts false and settles after mount, so the first
 * markup matches the server's. Never the primary gate — the server decides
 * whether to mount an Apple buy surface at all; this is the safety net inside
 * a shared component.
 */
export function useIapShell(): boolean {
  const [iap, setIap] = useState(false);
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') return;
    const storeShell = isStoreShellInBrowser(navigator.userAgent, document.cookie);
    setIap(iapAvailable({ storeShell, userAgent: navigator.userAgent, enabled: isAppleIapEnabled() }));
  }, []);
  return iap;
}
