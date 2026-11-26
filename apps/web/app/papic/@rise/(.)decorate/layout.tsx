import type { ReactNode } from 'react';
import { RiseRoute } from '@/app/_components/rise/rise-route';

/**
 * ⤴ "Decorate a photo", RISEN over My photos (final check A4-55, approved drawing § 05). The screen is this LAYOUT, so it
 * rises out of the tapped row the moment the tap lands; the page streams into it. The head carries the title, so the
 * page's own "← Back to my photos" and heading step aside here (`data-rise-hide`) — a hard load keeps both.
 */
export default function RisenDecorateLayout({ children }: { children: ReactNode }) {
  return (
    <RiseRoute title="Decorate a photo" data="papic-decorate">
      <div className="[&_[data-rise-hide]]:hidden">{children}</div>
    </RiseRoute>
  );
}
