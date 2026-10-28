'use client';

import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { vendorBarItems } from '@/app/vendor-dashboard/_components/vendor-bottom-nav';

/**
 * The supplier bar, drawn by its OWN resolver (`vendorBarItems`, what `VendorBottomNav` renders) for the coordinator
 * lab. Client-side because the resolver lives in a client module; a lab outside the app tree may not mount the bar
 * component itself (`seam-invariants.test.ts`).
 */
export function CoordLabBar({ runsEvents }: { runsEvents: boolean }) {
  return <BottomNav items={vendorBarItems({ role: 'owner', runsEvents })} />;
}
