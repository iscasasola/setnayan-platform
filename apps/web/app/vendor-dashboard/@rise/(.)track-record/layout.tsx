import type { ReactNode } from 'react';
import { RiseRoute } from '@/app/_components/rise/rise-route';

/**
 * ⤴ Track record RISES FROM THE SHOP SHELF (final check B16, drawing `final-check-area-5_2026-11-25.html` § B16, approved by the
 * owner 25 Nov): the shelf row's tap draws the real page inside the shared layer over Shop — full screen on a phone, the
 * centred dialog from 701 — and ✕ falls back to the shelf row. A hard load of the address draws the whole page, with
 * its own ‹ row. 🔒 app/vendor-dashboard/shop/the-shelf-tools-rise.test.ts
 */
export default function RisenTrackRecordLayout({ children }: { children: ReactNode }) {
  return (
    <RiseRoute page kind="stack" title="Track record" data="track-record">
      {children}
    </RiseRoute>
  );
}
