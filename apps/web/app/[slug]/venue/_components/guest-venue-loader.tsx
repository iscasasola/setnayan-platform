'use client';

/**
 * Client-only loader for the guest 3D venue explorer. Three.js needs WebGL +
 * `window`, absent during SSR — so the scene is dynamically imported with
 * `ssr: false` (same proven pattern as the seating lab + the veil reveal).
 */

import dynamic from 'next/dynamic';
import type { VenueScene } from './guest-venue-3d';

const GuestVenue3D = dynamic(() => import('./guest-venue-3d'), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[82vh] w-full items-center justify-center rounded-2xl border border-white/10 bg-[#0c0e14] text-sm text-white/55"
      role="status"
      aria-live="polite"
    >
      Loading the 3D room…
    </div>
  ),
});

export function GuestVenueLoader({
  scene,
  eventId,
}: {
  scene: VenueScene;
  /** Event UUID → the shared-room channel scope (slice 8); absent → single-player. */
  eventId?: string | null;
}) {
  return <GuestVenue3D scene={scene} eventId={eventId} />;
}
