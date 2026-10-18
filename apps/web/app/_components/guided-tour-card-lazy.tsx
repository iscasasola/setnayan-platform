'use client';

import { lazy, Suspense, type ComponentProps } from 'react';
import type { GuidedTourCard as Card } from './guided-tour-card';

/* 📦 THE OLD CAROUSEL, LOADED ONLY IF IT IS EVER DRAWN. It is switched off (`lib/tip-popups.ts`,
   owner 2026-10-03) and `GuidedTour` returns before rendering this — but a STATIC import still put
   the whole card in the first load of every page under a role layout, the Maker's included. The
   spotlight tour (`spotlight-mount.tsx`) replaces it; this door keeps the carousel one flip away
   at no first-load cost. */
const LazyCard = lazy(() => import('./guided-tour-card').then((m) => ({ default: m.GuidedTourCard })));

export function GuidedTourCardLazy(props: ComponentProps<typeof Card>) {
  return (
    <Suspense fallback={null}>
      <LazyCard {...props} />
    </Suspense>
  );
}
