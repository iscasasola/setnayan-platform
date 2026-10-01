'use client';

import { useEffect, useState } from 'react';
import { GuidedTourCard } from '@/app/_components/guided-tour-card';
import type { GuidedTourView } from '@/app/_components/tour-slide-view';
import type { TourKey } from '@/lib/tours';

const STORAGE_PREFIX = 'setnayan.tour_seen.';

// Guest-side wrapper for GuidedTour. Guests typically aren't signed in so
// we can't append to `users.tour_seen_keys` like the role welcomes do —
// instead we persist the "seen" flag in localStorage. Cleared by the
// browser, scoped to the host, no DB round-trip.
//
// Mount this inside the per-slug guest landing page. It only renders on
// the client because localStorage isn't readable on the server.
//
// ⚡ `tour` is drawn by the server (`guidedTourView` in guided-tour.tsx): this
// file is `'use client'`, and reading `lib/tours.ts` here shipped every tour's
// words to every guest (the diet, 2026-10-01).
export function GuestGuidedTour({ tourKey, tour }: { tourKey: TourKey; tour: GuidedTourView }) {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(STORAGE_PREFIX + tourKey);
      if (!seen) setShouldShow(true);
    } catch {
      // Private-mode browsers throw on localStorage — silently bail.
    }
  }, [tourKey]);

  if (!shouldShow) return null;

  const markSeen = async (key: TourKey): Promise<void> => {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + key, new Date().toISOString());
    } catch {
      // Tolerate localStorage write failure.
    }
    setShouldShow(false);
  };

  return <GuidedTourCard tourKey={tourKey} {...tour} completeAction={markSeen} />;
}
