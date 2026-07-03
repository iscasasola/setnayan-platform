'use client';

/**
 * Client-only loader for the 3D Plan demo scene — WebGL needs the browser, so
 * it's dynamically imported with `ssr: false`, same pattern as the couple
 * lab's `SeatingLabLoader` and the Save-the-Date veil reveal.
 */

import dynamic from 'next/dynamic';
import type {
  Lab3DTable,
  Lab3DFloor,
  Lab3DSceneObject,
  Lab3DBooth,
  Lab3DSign,
  Lab3DCocktail,
} from '@/lib/seating-3d';
import type { RolePalette } from '@/lib/mood-board';
import type { ReceptionDesign } from '@/lib/reception-scene';
import type { Plan3DGuest } from '@/app/_actions/plan3d-demo-actions';
import type { Plan3DWalkRequest, Plan3DRoamRequest } from './plan3d-scene';

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
  sceneObjects?: Lab3DSceneObject[];
  booths?: Lab3DBooth[];
  signs?: Lab3DSign[];
  cocktail?: Lab3DCocktail;
  rolePalette?: RolePalette;
  receptionDesign?: ReceptionDesign;
  venueSetting?: string;
  onGuestClick?: (guestId: string) => void;
  walkTarget?: Plan3DWalkRequest;
  onWalkComplete?: () => void;
  roam?: Plan3DRoamRequest;
  interactive?: boolean;
  /** Lighting/shadow budget — the desktop overlay runs 'high' (default), the
   *  phone guest walk passes 'low' (1024 shadow map + 128 env map). */
  quality?: 'high' | 'low';
}) {
  return <Plan3DSceneInner {...props} />;
}
