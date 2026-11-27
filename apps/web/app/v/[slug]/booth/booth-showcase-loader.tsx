'use client';

/**
 * Client-only loader for the booth showcase — WebGL needs `window`, absent in
 * SSR, so the Canvas client is dynamically imported with `ssr: false` (the same
 * pattern as the seating lab / guest walk / demo loaders).
 */

import dynamic from 'next/dynamic';
import { Ghost } from '@/components/skeletons';
import type { Lab3DBooth } from '@/lib/seating-3d';

// 🧊 `three` + `@react-three/*` live only in the client chunk below, fetched on demand (speed audit 2026-11-27, I1).
// While it loads, the shared skeleton holds the booth's own box (the canvas is the whole screen) — no hand-made screen.
const BoothShowcaseClient = dynamic(() => import('./booth-showcase-client'), {
  ssr: false,
  loading: () => (
    <div className="h-dvh w-full" role="status" aria-live="polite">
      <Ghost className="h-full w-full" />
      <span className="sr-only">Loading the booth…</span>
    </div>
  ),
});

export function BoothShowcaseLoader({ booth, vendorName }: { booth: Lab3DBooth; vendorName: string }) {
  return <BoothShowcaseClient booth={booth} vendorName={vendorName} />;
}
