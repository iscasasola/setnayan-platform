import type { ReactNode } from 'react';
import { RiseRoute } from '@/app/_components/rise/rise-route';

/**
 * ⤴ MAKING A SERVICE CARD RISES OVER SHOP (final check B8, drawing `final-check-area-5_2026-11-25.html` § B8, approved
 * by the owner 25 Nov). A tap on "＋ Create service card" draws the picker and then the card maker inside ONE layer over
 * the page you were on (this layout spans `new` and `new/[category]`, so the layer stays up between them): full screen
 * on a phone, the large centred dialog from 701. ✕ falls back to that page at the same scroll. A hard load of the
 * address is not intercepted and draws the whole page, as before. 🔒 app/vendor-dashboard/services/the-maker-rises.test.ts
 */
export default function RisenNewServiceLayout({ children }: { children: ReactNode }) {
  return (
    <RiseRoute page kind="stack" title="New service" data="service-maker-new">
      {children}
    </RiseRoute>
  );
}
