'use client';

import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { vendorBarItems } from '@/app/vendor-dashboard/_components/vendor-bottom-nav';

/**
 * The supplier bar, drawn by its OWN resolver (`vendorBarItems`, what `VendorBottomNav` renders) for the coordinator
 * lab. Client-side because the resolver lives in a client module; a lab outside the app tree may not mount the bar
 * component itself (`seam-invariants.test.ts`).
 */
/**
 * `runsEvents` no longer changes the bar (THE ONE BUILD, 8 Nov 2026: no Hub/Events tab for anyone — the coordinator's
 * door is Today's "Events you run"). Kept optional so `coord-lab.tsx` (the Shop lane's file) still compiles; it may
 * drop the prop.
 */
export function CoordLabBar(_props: { runsEvents?: boolean }) {
  return <BottomNav items={vendorBarItems({ role: 'owner' })} />;
}
