'use client';

import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { vendorBarItems } from '@/app/vendor-dashboard/_components/vendor-bottom-nav';

/**
 * The supplier bar, drawn by its OWN resolver (`vendorBarItems`, what `VendorBottomNav` renders) for the coordinator
 * lab. Client-side because the resolver lives in a client module; a lab outside the app tree may not mount the bar
 * component itself (`seam-invariants.test.ts`).
 */
/**
 * No `runsEvents` (THE ONE BUILD, 8 Nov 2026: no Hub/Events tab for anyone — the coordinator's door is Today's "Events
 * you run"); the integration dropped the prop from both labs.
 */
export function CoordLabBar() {
  return <BottomNav items={vendorBarItems({ role: 'owner' })} />;
}
