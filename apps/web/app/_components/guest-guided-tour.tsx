'use client';

import { useEffect, useState } from 'react';
import { GuidedTour } from '@/app/_components/guided-tour';
import type { TourKey } from '@/lib/tours';

const STORAGE_PREFIX = 'setnayan.tour_seen.';

// Guest-side wrapper for GuidedTour. Guests typically aren't signed in so
// we can't append to `users.tour_seen_keys` like the role welcomes do —
// instead we persist the "seen" flag in localStorage. Cleared by the
// browser, scoped to the host, no DB round-trip.
//
// Mount this inside the per-slug guest landing page. It only renders on
// the client because localStorage isn't readable on the server.
export function GuestGuidedTour({ tourKey }: { tourKey: TourKey }) {
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

  return <GuidedTour tourKey={tourKey} completeAction={markSeen} />;
}
