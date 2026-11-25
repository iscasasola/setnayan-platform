import type { ReactNode } from 'react';
import { RiseRoute } from '@/app/_components/rise/rise-route';

/**
 * ⤴ A STATIC SIBLING OF A CARD (final check B8). `(.)services/[serviceId]` would intercept this address too (a
 * dynamic folder matches any name — measured in the rise-route lab), so it is named here and rises as itself: the
 * house full-screen rise for a page reached by a tap, headed by its own name. A hard load draws the whole page.
 * 🔒 app/vendor-dashboard/services/the-maker-rises.test.ts
 */
export default function RisenTheirWorkLayout({ children }: { children: ReactNode }) {
  return (
    <RiseRoute title="Their work" data="their-work">
      {children}
    </RiseRoute>
  );
}
