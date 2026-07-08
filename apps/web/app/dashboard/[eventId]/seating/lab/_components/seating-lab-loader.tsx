'use client';

/**
 * Client-only loader for the 3D seating lab. Three.js needs the browser's
 * WebGL context + `window`, which don't exist during SSR — so the heavy scene
 * is dynamically imported with `ssr: false` (the same proven pattern the
 * Save-the-Date veil reveal uses). This wrapper renders a lightweight
 * placeholder while the WebGL bundle streams in.
 */

import dynamic from 'next/dynamic';
import type {
  Lab3DTable,
  Lab3DFloor,
  Lab3DFloorExtras,
  Lab3DGuest,
  Lab3DGroup,
  Lab3DMonogram,
  Lab3DSceneObject,
  Lab3DBooth,
  Lab3DSign,
} from '@/lib/seating-3d';
import type { KeepApartRule, PriorityOrder } from '@/lib/seating';
import type { RolePalette } from '@/lib/mood-board';
import type { ReceptionDesign } from '@/lib/reception-scene';

const SeatingLab3D = dynamic(() => import('./seating-lab-3d'), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[80vh] w-full items-center justify-center rounded-2xl border border-ink/10 bg-ink/[0.03] text-sm text-ink/55"
      role="status"
      aria-live="polite"
    >
      Loading the 3D room…
    </div>
  ),
});

type Props = {
  eventId: string;
  tables: Lab3DTable[];
  floor: Lab3DFloor;
  guests: Lab3DGuest[];
  rolePalette: RolePalette;
  /** Couple's saved reception treatments (Wave 2b) — drives the 3D decor. */
  receptionDesign: ReceptionDesign;
  /** Room archetype (`events.venue_setting`) — swaps the 3D room shell. */
  venueSetting: string;
  monogram: Lab3DMonogram;
  /** Couple owns the paid ANIMATED_MONOGRAM → the floor mark blooms on Play. */
  animatedMonogram: boolean;
  me: { id: string; name: string };
  /** Smart seat-plan rules — keep-apart pairs + the couple's tier priority order. */
  keepApart: KeepApartRule[];
  priorityOrder: PriorityOrder;
  roleSetKey: string;
  groups: Lab3DGroup[];
  floorExtras: Lab3DFloorExtras;
  /** Placed venue fixtures rendered read-only in 3D (the 2D editor owns edits). */
  sceneObjects: Lab3DSceneObject[];
  booths: Lab3DBooth[];
  signs: Lab3DSign[];
};

export function SeatingLabLoader(props: Props) {
  return <SeatingLab3D {...props} />;
}
