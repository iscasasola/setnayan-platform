'use client';

import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { isEventDayActive } from '@/lib/day-of-mode';

/**
 * Day-of "you're editing live" banner (seat-finding PR 5).
 *
 * Renders only across the wedding-day span (see {@link isEventDayActive}), so
 * normal pre-wedding planning is unaffected. It encodes the owner's two day-of
 * locks for editors:
 *   • live propagation — a reseat reaches the guest "Find your seat" instantly;
 *   • digital-only responsibility — printed cards/signs are FROZEN snapshots;
 *     today the live digital plan is the single source of truth (Setnayan does
 *     not reconcile paper).
 *
 * A render-nothing sibling of <SeatingEditor> (kept out of the 4k-line editor),
 * it re-checks the clock on an interval + on tab-focus so it appears/disappears
 * as the window opens/closes without a reload.
 */
export function DayOfEditingBanner({ eventDate }: { eventDate: string | Date | null | undefined }) {
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!eventDate) return;
    const tick = () => setLive(isEventDayActive(eventDate));
    tick();
    const id = setInterval(tick, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [eventDate]);

  if (!live) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm"
    >
      <span className="relative mt-0.5 flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400/70" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
      </span>
      <div className="space-y-0.5">
        <p className="flex items-center gap-1.5 font-semibold text-rose-900">
          <Radio aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Live — guests are seeing this now
        </p>
        <p className="text-rose-900/70">
          Every seat change reaches the digital <span className="font-medium">Find your seat</span>{' '}
          the moment you make it. Printed escort cards, table signs, and boards are frozen snapshots —
          today the live plan is the source of truth.
        </p>
      </div>
    </div>
  );
}
