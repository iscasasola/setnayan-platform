'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * ⭐ WAVE 8 · THE STATUS BANNERS, LIFTED OUT OF THE LAYOUT
 * (owner-locked 2026-07-25 · Live_Studio_Unified_Spec_2026-07-25 § 4g.)
 *
 * The controller answers ~20 different `?zone_added=1` / `?camera_error=bind`
 * style outcomes with a banner. Stacked in the page flow — which is what Waves
 * 1–7 did — each one is ~48px of layout appearing directly above the monitor, so
 * on a fixed 360×640 viewport a single server action could shove the transport
 * row off a screen the operator cannot scroll.
 *
 * So they float instead: `position: fixed`, zero layout cost, over the top of the
 * surface. Two consequences handled here:
 *
 *   • THEY MUST NOT LINGER. A floating panel sitting permanently over the CH 1
 *     monitor would be worse than the push it replaced, and these banners have no
 *     dismiss of their own — they live as long as the query string does. So they
 *     time out. `role="status"` has already announced them by then.
 *   • THEY MUST NOT SWALLOW A TAP. The wrapper is `pointer-events-none` (set by
 *     the caller) so a thumb aimed at the monitor underneath still lands.
 *
 * Reduced motion: there is no animation to suppress — it hides, it does not fade.
 * SSR-safe: renders its children on the server and on first paint, so a banner is
 * present in the initial HTML and for a no-JS reader.
 */

/** Long enough to read a sentence, short enough not to camp on the monitor. */
const DISMISS_MS = 6_000;

export function ToastLayer({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setShown(false), DISMISS_MS);
    return () => clearTimeout(id);
  }, []);

  if (!shown) return null;
  return <>{children}</>;
}
