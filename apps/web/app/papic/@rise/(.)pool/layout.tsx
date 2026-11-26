import type { ReactNode } from 'react';
import { RiseRoute } from '@/app/_components/rise/rise-route';

/**
 * ⤴ "Everyone's photos", RISEN over My photos (final check A4-81, approved drawing § 06). As the decorator beside it:
 * the screen is this layout, the page streams in, and its own "← Back to my photos" and heading step aside here.
 */
export default function RisenPoolLayout({ children }: { children: ReactNode }) {
  return (
    <RiseRoute title="Everyone’s photos" data="papic-pool">
      <div className="[&_[data-rise-hide]]:hidden">{children}</div>
    </RiseRoute>
  );
}
