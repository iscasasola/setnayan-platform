import { routes } from '@/lib/routes';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { getSampleEvent } from './_lib/sample-event';

/**
 * Chrome for the public Maria & Jose tour. Reads the sample event per request
 * via the service-role resolver, so it's dynamic. A persistent ribbon makes the
 * "this is a sample, nothing is saved" promise unmissable on every stop.
 *
 * 🔑 THE SAMPLE IS RESOLVED HERE, BEFORE ANY STOP STREAMS. Three stops (budget, gallery, vendors) carry their own
 * `loading.tsx`, and a boundary commits HTTP 200 before the page body runs — so the reader's fail-safe `notFound()`,
 * fired from those pages, would have answered a vanished sample with a 200 and a skeleton. Awaited in this layout
 * (above every stop's boundary) it is a real 404. `getSampleEvent` is `cache()`d: the stops' own calls reuse this read.
 * 🔒 app/_components/a-route-decides-before-it-streams.test.ts
 */
export const dynamic = 'force-dynamic';

export default async function TourLayout({ children }: { children: ReactNode }) {
  await getSampleEvent();
  return (
    <>
      <div
        role="note"
        className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-[#1B1A17] px-4 py-2 text-center text-xs font-medium text-[#FBF6EA]"
      >
        <span aria-hidden>●</span>
        <span>
          You&rsquo;re exploring <strong>Maria &amp; Jose</strong> — a sample wedding. Nothing you tap here is saved.
        </span>
        <Link href={routes.start()} className="underline decoration-[#FBF6EA]/40 underline-offset-2 hover:decoration-[#FBF6EA]">
          Start your own, free
        </Link>
      </div>
      {children}
    </>
  );
}
