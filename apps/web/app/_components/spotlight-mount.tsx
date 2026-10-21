'use client';

import { lazy, Suspense, useEffect, useState } from 'react';
import type { SpotlightScript, TourKey } from '@/lib/tours';
import { spotlightSteps } from '@/lib/spotlight-steps';

/* 📦 THE ENGINE LOADS ONLY WHEN A TOUR RUNS. A bare `React.lazy` (as `couple-logo.tsx` does): the
   tour never renders on the server, so it needs none of `next/dynamic`'s SSR machinery. A person
   whose tour is done never downloads it, and the Maker's first load never carries it
   (`scripts/check-maker-js-budget.mjs` — this mount sits in the dashboard layout above it). */
const SpotlightTour = lazy(() => import('./spotlight-tour').then((m) => ({ default: m.SpotlightTour })));

/** The account menu's "Show me around" fires this; the role layout's mount answers it. */
export const SPOTLIGHT_REPLAY_EVENT = 'sn:spotlight';

/**
 * 🔦 MOUNTS ONE SPOTLIGHT TOUR (the engine is `spotlight-tour.tsx`).
 *
 * First visit (`seen` false — read by the server from `users.tour_seen_keys`): it starts, and
 * finishing or skipping records it with the shipped `completeTour` (no new server action). Seen:
 * nothing at all until `replay` mounts hear the account menu's "Show me around"; a replay starts
 * at step 1 and never writes the record again.
 *
 * The script arrives as plain words from the server (`lib/tours.ts` never reaches the browser —
 * `lib/tours-stay-on-the-server.test.ts`).
 */
export function SpotlightMount({
  tourKey,
  script,
  seen,
  replay = false,
  name = null,
  completeAction,
}: {
  tourKey: TourKey;
  script: SpotlightScript;
  seen: boolean;
  /** Answers "Show me around" (one mount per layout — never two tours at once). */
  replay?: boolean;
  /** The person's display name, for a welcome step's "Welcome, {name}". */
  name?: string | null;
  completeAction: (tourKey: TourKey) => Promise<void>;
}) {
  const [run, setRun] = useState<{ record: boolean; restart: boolean; n: number } | null>(null);

  useEffect(() => {
    if (!seen) setRun({ record: true, restart: false, n: 0 });
    if (!replay) return;
    // Lets the account menu draw "Show me around" only where there is a tour to show.
    document.documentElement.setAttribute('data-spotlight', '');
    const onReplay = () => setRun((r) => ({ record: false, restart: true, n: (r?.n ?? 0) + 1 }));
    window.addEventListener(SPOTLIGHT_REPLAY_EVENT, onReplay);
    return () => {
      window.removeEventListener(SPOTLIGHT_REPLAY_EVENT, onReplay);
      document.documentElement.removeAttribute('data-spotlight');
    };
  }, [seen, replay]);

  if (!run || script.steps.length === 0) return null;
  return (
    <Suspense fallback={null}>
      <SpotlightTour
        key={run.n}
        tourKey={tourKey}
        steps={spotlightSteps(script.steps, run.record)}
        name={name}
        finale={script.finale}
        record={run.record}
        restart={run.restart}
        completeAction={completeAction}
        onClose={() => setRun(null)}
      />
    </Suspense>
  );
}
