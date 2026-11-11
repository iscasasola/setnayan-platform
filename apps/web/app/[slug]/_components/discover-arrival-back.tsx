'use client';

import { useEffect, useState } from 'react';
import { BackButton } from '@/app/_components/back-button';
import { arrivedFromDiscover, withoutDiscoverArrival } from '@/lib/discover-way-back';

/**
 * ‹ Discover — ONLY for a visitor who opened this event from Discover (2026-11-12, DECISION_LOG "DISCOVER WITH
 * SUPPLIERS — PROTOTYPE APPROVED", answer 3: *"Show one small back button only to a visitor who came from Discover.
 * Invited guests see nothing from Setnayan."*).
 *
 * This is the host's own page, in the host's own look, so nothing is drawn by default: the server never draws it
 * (the cached Event Hub stays byte-for-byte the same — `lib/hub-view-key.ts`), and in the browser it appears only when
 * the address carries Discover's arrival marker (`?via=discover`, put on by Discover's event cards —
 * `lib/discover-way-back.ts`). An invitation link never carries it. The marker is taken OUT of the address at once,
 * so a copied or shared address never hands it on.
 *
 * It returns IN PLACE (Discover comes back with its scroll) while the visitor is still where they arrived; once they
 * open a tab (the hub pushes tabs as history), the press goes to Discover by its address instead.
 */
export function DiscoverArrivalBack() {
  const [arrivedAt, setArrivedAt] = useState<string | null>(null);
  useEffect(() => {
    if (!arrivedFromDiscover(window.location.search)) return;
    const clean = withoutDiscoverArrival(window.location.pathname + window.location.search + window.location.hash);
    try {
      window.history.replaceState(window.history.state, '', clean);
    } catch {
      /* the address keeps the marker; the button still works */
    }
    setArrivedAt(window.location.pathname + window.location.search + window.location.hash);
  }, []);
  if (arrivedAt === null) return null;
  return (
    <div
      className="fixed left-3 z-50 rounded-md bg-cream/90 shadow-sm backdrop-blur-sm"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      data-discover-arrival-back=""
    >
      <BackButton href="/" label="Discover" className="mb-0" inPlace={{ whileAt: arrivedAt }} />
    </div>
  );
}
