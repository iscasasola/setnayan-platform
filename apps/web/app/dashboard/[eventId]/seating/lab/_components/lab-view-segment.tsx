'use client';

/**
 * The mirrored [2D · 3D · List] segment on the 3D lab chrome (council verdict
 * 2026-07-15 §4). Heals the doorway fork: 3D → 2D / List is now one click, so
 * the projection is never orphaned. Minimal — it only routes back to the 2D
 * editor; it does not restructure the lab.
 */

import { useRouter } from 'next/navigation';
import { SeatingViewSegment } from '../../_components/seating-frame';

export function LabViewSegment({ eventId }: { eventId: string }) {
  const router = useRouter();
  return (
    <div className="absolute left-3 top-3 z-30">
      <SeatingViewSegment
        active="3d"
        onSelect={(target) => {
          if (target === '2d') router.push(`/dashboard/${eventId}/seating`);
          else if (target === 'list') router.push(`/dashboard/${eventId}/seating?view=list`);
        }}
      />
    </div>
  );
}
