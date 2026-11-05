'use client';

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { SpotlightScript, TourKey } from '@/lib/tours';
import { spotlightSteps } from '@/lib/spotlight-steps';

/* 📦 THE ENGINE LOADS ONLY WHEN A TOUR RUNS. A bare `React.lazy` (as `couple-logo.tsx` does): the
   tour never renders on the server, so it needs none of `next/dynamic`'s SSR machinery. A person
   whose tour is done never downloads it, and the Maker's first load never carries it
   (`scripts/check-maker-js-budget.mjs` — this mount sits in the dashboard layout above it). */
const SpotlightTour = lazy(() => import('./spotlight-tour').then((m) => ({ default: m.SpotlightTour })));

/**
 * The account menu's "Show me around" fires this; the role layout's mount answers it — unless the page on screen
 * has a tour of its own (a `replay="page"` mount), which answers instead (owner 2026-10-22: "Show me around" plays
 * the page's tour where there is one). A `detail.tourKey` asks one tour by name (the Maker's ⋯ › About the Maker).
 */
export const SPOTLIGHT_REPLAY_EVENT = 'sn:spotlight';
/** On <html> while a page's own tour can replay: its key. */
const PAGE_ATTR = 'data-spotlight-page';

/**
 * 🧱 TWO NEVER STACK, EVEN BACK TO BACK. A page tour waits for another (`after`) — but the journey can END on a page
 * that has its own tour (the host's ends on Suppliers, the supplier's on Today). Finishing it records it, the layout
 * re-reads `tour_seen_keys`, and the page tour would start the instant the "You're set" card closed. So the tour
 * that just finished is remembered with the page it finished on, and a tour waiting for it starts on the NEXT visit
 * to that page instead. Any move to another page forgets it (`usePathname`, below).
 */
let finishedHere: { key: string; path: string } | null = null;
const here = () => (typeof window === 'undefined' ? '' : window.location.pathname);

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
  inMaker = false,
  after,
}: {
  tourKey: TourKey;
  script: SpotlightScript;
  seen: boolean;
  /** Answers "Show me around" (one mount per layout — never two tours at once); `'page'`: this page's own tour,
      which answers in place of the layout's. */
  replay?: boolean | 'page';
  /** Drawn inside the Maker — the engine does not pause for it (`lib/host-page-tours.ts`). */
  inMaker?: boolean;
  /** The person's display name, for a welcome step's "Welcome, {name}". */
  name?: string | null;
  completeAction: (tourKey: TourKey) => Promise<void>;
  /** The tour this one waits for — if it finished on THIS page a moment ago, this one waits for the next visit. */
  after?: TourKey;
}) {
  const [run, setRun] = useState<{ record: boolean; restart: boolean; n: number } | null>(null);
  const pathname = usePathname();
  const complete = useCallback(
    (k: TourKey) => {
      finishedHere = { key: k, path: here() };
      return completeAction(k);
    },
    [completeAction],
  );

  useEffect(() => {
    if (finishedHere && finishedHere.path !== here()) finishedHere = null;
  }, [pathname]);

  useEffect(() => {
    const justFinished = after != null && finishedHere?.key === after && finishedHere.path === here();
    if (justFinished) {
      // The tour this one waits for closed on this page a moment ago — this one waits for the next visit.
    } else if (!seen) setRun({ record: true, restart: false, n: 0 });
    if (!replay) return;
    const html = document.documentElement;
    const page = replay === 'page';
    // Lets the account menu draw "Show me around" only where there is a tour to show.
    const setShow = !html.hasAttribute('data-spotlight');
    if (setShow) html.setAttribute('data-spotlight', '');
    if (page) html.setAttribute(PAGE_ATTR, tourKey);
    const onReplay = (e: Event) => {
      const asked = (e as CustomEvent<{ tourKey?: string } | null>).detail?.tourKey;
      if (asked ? asked !== tourKey : !page && html.hasAttribute(PAGE_ATTR)) return;
      setRun((r) => ({ record: false, restart: true, n: (r?.n ?? 0) + 1 }));
    };
    window.addEventListener(SPOTLIGHT_REPLAY_EVENT, onReplay);
    return () => {
      window.removeEventListener(SPOTLIGHT_REPLAY_EVENT, onReplay);
      if (setShow) html.removeAttribute('data-spotlight');
      if (page && html.getAttribute(PAGE_ATTR) === tourKey) html.removeAttribute(PAGE_ATTR);
    };
  }, [seen, replay, tourKey, after]);

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
        completeAction={complete}
        inMaker={inMaker}
        onClose={() => setRun(null)}
      />
    </Suspense>
  );
}
