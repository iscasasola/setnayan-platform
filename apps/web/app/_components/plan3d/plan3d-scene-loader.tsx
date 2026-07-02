'use client';

/**
 * Client-only loader for the 3D Plan demo scene — WebGL needs the browser, so
 * it's dynamically imported with `ssr: false`, same pattern as the couple
 * lab's `SeatingLabLoader` and the Save-the-Date veil reveal.
 */

import dynamic from 'next/dynamic';
import type { Lab3DTable, Lab3DFloor } from '@/lib/seating-3d';
import type { Plan3DGuest } from '@/app/_actions/plan3d-demo-actions';
import type { Plan3DWalkRequest } from './plan3d-scene';

const Plan3DSceneInner = dynamic(() => import('./plan3d-scene').then((m) => m.Plan3DScene), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#8c8884',
        fontSize: 13,
      }}
      role="status"
      aria-live="polite"
    >
      Loading the room…
    </div>
  ),
});

export function Plan3DSceneLoader(props: {
  tables: Lab3DTable[];
  floor: Lab3DFloor;
  guests: Plan3DGuest[];
  onGuestClick?: (guestId: string) => void;
  walkTarget?: Plan3DWalkRequest;
  onWalkComplete?: () => void;
  interactive?: boolean;
}) {
  return <Plan3DSceneInner {...props} />;
}
