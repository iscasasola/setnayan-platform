'use client';

/**
 * Client-only loader for the booth showcase — WebGL needs `window`, absent in
 * SSR, so the Canvas client is dynamically imported with `ssr: false` (the same
 * pattern as the seating lab / guest walk / demo loaders).
 */

import dynamic from 'next/dynamic';
import type { Lab3DBooth } from '@/lib/seating-3d';

const BoothShowcaseClient = dynamic(() => import('./booth-showcase-client'), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-dvh w-full items-center justify-center bg-[#efe9dd] text-sm text-black/55"
      role="status"
      aria-live="polite"
    >
      Loading the booth…
    </div>
  ),
});

export function BoothShowcaseLoader({ booth, vendorName }: { booth: Lab3DBooth; vendorName: string }) {
  return <BoothShowcaseClient booth={booth} vendorName={vendorName} />;
}
