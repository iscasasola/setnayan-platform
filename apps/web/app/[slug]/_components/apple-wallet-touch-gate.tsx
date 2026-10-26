'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { isAppleTouchDevice } from '@/lib/apple-device';

/**
 * 📱 "ADD TO APPLE WALLET" ON AN iPAD IN SAFARI (owner 2026-10-26, "Yes to all").
 *
 * iPad Safari sends a Mac user-agent ("Macintosh; Intel Mac OS X 10_15_7 … Safari"), so the server cannot tell it
 * from a Mac — and a Mac has no Apple Wallet. For exactly that case `appleWalletLink` hands a `touchOnly` link, and
 * `AppleWalletButton` wraps its badge in this gate: nothing on the server and nothing on first paint (so hydration
 * agrees, and a Mac never gets a box or a gap), then — after mount — the badge only if the browser says it is an
 * Apple touch device (`isAppleTouchDevice(ua, navigator.maxTouchPoints)`: a "Macintosh" with more than one touch
 * point is an iPad). The same rule `appleWalletDevice` applies (lib/wallet-pass.ts — not imported here: that file
 * carries `node:crypto`, which a client chunk cannot). An iPhone's link is never `touchOnly`: its badge is in the
 * server's HTML, no shift.
 */
export function AppleWalletTouchGate({ children }: { children: ReactNode }) {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    setTouch(isAppleTouchDevice(navigator.userAgent, navigator.maxTouchPoints));
  }, []);
  return touch ? <>{children}</> : null;
}
