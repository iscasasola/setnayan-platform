import type { ReactNode } from 'react';
import '@/app/_components/frontdoor/front-door.css';

/**
 * ⤴ RISE-ROUTE LAB — the batch-3 mechanism (build-sessions/RISE-AUDIT-2026-11-13.md § H) with no session and no
 * database: the SHIPPED avatar sheet body (`SwitcherPanelBody`, here = 'shop'), its rows pointed at this lab's own
 * pages, which a soft tap RISES through the same `@rise/(.)…` slot + `RiseRoute` the supplier layout uses.
 */
export default function RiseRouteLabLayout({ children, rise }: { children: ReactNode; rise: ReactNode }) {
  return (
    <>
      {children}
      {rise}
    </>
  );
}
