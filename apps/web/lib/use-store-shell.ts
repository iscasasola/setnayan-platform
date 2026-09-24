'use client';

import { useEffect, useState } from 'react';
import { isStoreShellInBrowser } from '@/lib/store-shell';

/**
 * useIsStoreShell — is this client component running inside the App Store /
 * Play Store shell (Capacitor)? The client-side twin of `isStoreShellRequest()`
 * (lib/request-platform.ts); the rule and its rationale live in
 * lib/store-shell.ts.
 *
 * Starts `false` and settles after mount, so server and client render the same
 * first markup (no hydration mismatch). A price can therefore paint for one
 * frame before it is withdrawn — so this hook is the SAFETY NET inside a shared
 * price-bearing component, never the primary gate. Wherever a server component
 * decides whether to mount the priced thing, it asks `isStoreShellRequest()`
 * and does not render it at all.
 *
 * Desktop (Tauri, `SetnayanApp/desktop`) answers false — Apple never reviews it.
 */
export function useIsStoreShell(): boolean {
  const [storeShell, setStoreShell] = useState(false);
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') return;
    setStoreShell(isStoreShellInBrowser(navigator.userAgent, document.cookie));
  }, []);
  return storeShell;
}
