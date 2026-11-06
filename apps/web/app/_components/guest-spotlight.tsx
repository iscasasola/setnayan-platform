'use client';

import { useEffect, useState } from 'react';
import type { SpotlightScript, TourKey } from '@/lib/tours';
import { SpotlightMount } from './spotlight-mount';

/** The same key space as the old guest carousel (`guest-guided-tour.tsx`), so a guest's phone keeps one store. */
const STORAGE_PREFIX = 'setnayan.tour_seen.';

/**
 * 🔦 A SPOTLIGHT FOR A SIGNED-OUT GUEST (owner 2026-10-25, "the spotlight tour is missing so many parts"). A guest
 * has no `users` row, so `<Spotlight>` (which reads `tour_seen_keys`) draws nothing for them: the seen mark lives on
 * their phone instead, as the switched-off `GuestGuidedTour` kept it. Same engine, same look, lazily loaded.
 *
 * `script` is drawn by the SERVER page from `lib/tours.ts` — this file is `'use client'` and must never import the
 * words (`lib/tours-stay-on-the-server.test.ts`). localStorage that throws (private mode) = no tour, never a loop.
 */
export function GuestSpotlight({ tourKey, script }: { tourKey: TourKey; script: SpotlightScript }) {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setSeen(window.localStorage.getItem(STORAGE_PREFIX + tourKey) !== null);
    } catch {
      setSeen(true);
    }
  }, [tourKey]);

  if (seen !== false) return null;
  return (
    <SpotlightMount
      tourKey={tourKey}
      script={script}
      seen={false}
      completeAction={async (k) => {
        try {
          window.localStorage.setItem(STORAGE_PREFIX + k, new Date().toISOString());
        } catch {
          // A phone that cannot store it simply sees the tour again next time.
        }
      }}
    />
  );
}
