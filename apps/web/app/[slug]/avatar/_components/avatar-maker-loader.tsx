'use client';

/**
 * Client-only boundary for the maker. Three.js needs WebGL + `window`, absent
 * during SSR — the same `ssr: false` dynamic import the seating lab, the veil
 * reveal and the guest venue walk all use.
 */

import dynamic from 'next/dynamic';

const AvatarMaker = dynamic(() => import('./avatar-maker').then((m) => m.AvatarMaker), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[70vh] w-full items-center justify-center rounded-2xl border border-white/10 bg-[#0c0e14] text-sm text-white/55"
      role="status"
      aria-live="polite"
    >
      Loading the avatar maker…
    </div>
  ),
});

export function AvatarMakerLoader(props: {
  eventId: string;
  slug: string;
  figureId: string;
  initialConfig: unknown;
  hasSaved: boolean;
}) {
  return <AvatarMaker {...props} />;
}
