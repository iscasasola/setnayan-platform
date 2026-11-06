'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { isAppleTouchDevice } from '@/lib/apple-device';

/**
 * 🍎 iPAD SAFARI IS AN APPLE DEVICE TOO (iPad + Duo audit W1, 2026-10-19).
 *
 * iPad Safari sends a Mac user-agent (measured on the iPad Pro 11-inch
 * simulator: `Macintosh; Intel Mac OS X 10_15_7 … Version/26.5 Safari`), so a
 * server reading the request cannot tell it from a Mac — and a Mac gets "Save
 * to my account · with Google". Only the browser can see past it: a Mac has no
 * touch screen, an iPad reports `maxTouchPoints` 5.
 *
 * So for exactly that case (`mightBeIpadSafari`) the server draws BOTH: `web`
 * is what it would draw for a Mac, `apple` the same block drawn for Apple. The
 * first paint is `web` (it is what the server's HTML holds, so hydration
 * agrees); after mount, an Apple touch device swaps to `apple`. The block
 * carries its own pick (`SAVE_METHOD_FIELD`), so the press opens the provider
 * the button now names — never a mix of the two.
 *
 * 🍏🤖 With BOTH providers on (owner 2026-10-25, "Show both") each block holds
 * both buttons, so this swap decides only the ORDER (Apple first on an iPad).
 */
export function AppleOnTouch({ web, apple }: { web: ReactNode; apple: ReactNode }) {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    setTouch(isAppleTouchDevice(navigator.userAgent, navigator.maxTouchPoints));
  }, []);
  return <>{touch ? apple : web}</>;
}
