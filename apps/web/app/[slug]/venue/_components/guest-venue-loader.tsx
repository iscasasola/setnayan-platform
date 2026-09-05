'use client';

/**
 * Client-only loader for the guest 3D venue explorer. Three.js needs WebGL +
 * `window`, absent during SSR — so the scene is dynamically imported with
 * `ssr: false` (same proven pattern as the seating lab + the veil reveal).
 */

import dynamic from 'next/dynamic';
import type { VenueScene } from './guest-venue-3d';
import { useLiveScene } from './use-live-scene';

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
  scene: initialScene,
  eventId,
  slug,
  token,
}: {
  scene: VenueScene;
  /** Event UUID → the shared-room channel scope (slice 8); absent → single-player. */
  eventId?: string | null;
  /** The address + the guest's personal token — what the page itself called
   *  `public_venue_scene` with, so the browser can ask the same question again
   *  while the guest is inside (owner 2026-09-06: seating can change during
   *  the event). Omit `slug` and the room is a one-shot, exactly as before. */
  slug?: string | null;
  token?: string | null;
}) {
  // The room you are standing in keeps up: re-asks the RPC while visible and
  // swaps the scene in only when something a guest can see has moved.
  const { scene, takenDown } = useLiveScene(initialScene, {
    slug: slug ?? '',
    token: token ?? null,
    enabled: Boolean(slug),
  });
  return (
    <div className="relative">
      <GuestVenue3D scene={scene} eventId={eventId} />
      {takenDown ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full border border-white/15 bg-black/70 px-4 py-2 text-sm text-white/85 backdrop-blur"
        >
          Your hosts have taken the room down for now — what you see is the last version.
        </div>
      ) : null}
    </div>
  );
}
