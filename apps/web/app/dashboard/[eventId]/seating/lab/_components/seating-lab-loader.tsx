'use client';

/**
 * Client-only loader for the 3D seating lab. Three.js needs the browser's
 * WebGL context + `window`, which don't exist during SSR — so the heavy scene
 * is dynamically imported with `ssr: false` (the same proven pattern the
 * Save-the-Date veil reveal uses). This wrapper renders a lightweight
 * placeholder while the WebGL bundle streams in.
 */

import dynamic from 'next/dynamic';
import type { Lab3DTable, Lab3DFloor, Lab3DGuest } from '@/lib/seating-3d';

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
  paletteHexes: string[];
  coupleNames: string | null;
};

export function SeatingLabLoader(props: Props) {
  return <SeatingLab3D {...props} />;
}
