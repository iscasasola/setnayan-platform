'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { PEOPLE_WITH_ACCESS_ANCHOR } from '@/lib/people-with-access-href';
import { I_SEGMENTED_CLASS, iSegClass } from '../../website/editor/_components/inspector-kit';
import { DETAILS_SEGMENTS, type DetailsSegmentKey } from '@/lib/event-details-segments';

/**
 * 🎚 EVENT DETAILS' PINNED LINE + SEGMENTED CONTROL — Event · Access · Settings
 * (owner 2026-10-07, DECISION_LOG "EVENT DETAILS IS THREE SEGMENTS"; the
 * Suppliers / Guests shape). The couple's line and the one segmented control
 * float under the shell (`sn-glass-row`, the floating row's glass); one body
 * shows below.
 *
 *   · The control is the app's ONE segmented control — `ISegmented`'s track
 *     (`I_SEGMENTED_CLASS`) and `ISeg`'s look in Setnayan wine (`iSegClass(on,
 *     'wine')`).
 *   · All three bodies arrive from the server at once, so a tap shows its body
 *     at once (no round trip); the address keeps `?view=` (replaceState) so a
 *     reload or a shared link lands on the same segment.
 *   · Tapping the segment you are on takes you back to the top (Button rule 6).
 */
export function DetailsSegments({
  initial,
  who,
  line,
  accessBadge,
  bodies,
}: {
  initial: DetailsSegmentKey;
  /** "Maria & Jose". */
  who: string;
  /** "Wedding · Fri 18 Dec 2026 · Quezon City". */
  line: string;
  /** The people with access, counted — null draws no number. */
  accessBadge: string | null;
  bodies: Record<DetailsSegmentKey, ReactNode>;
}) {
  const [at, setAt] = useState<DetailsSegmentKey>(initial);
  /* The links that already point at People with access (`peopleWithAccessHref`,
     Home's access card) land on the Access segment, then on the list itself. */
  useEffect(() => {
    if (window.location.hash !== `#${PEOPLE_WITH_ACCESS_ANCHOR}`) return;
    setAt('access');
    requestAnimationFrame(() => document.getElementById(PEOPLE_WITH_ACCESS_ANCHOR)?.scrollIntoView({ block: 'start' }));
  }, []);
  const pick = (k: DetailsSegmentKey) => {
    if (k === at) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setAt(k);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('view', k);
      window.history.replaceState(window.history.state, '', url.toString());
    } catch {
      /* the address is a convenience; the segment already shows */
    }
  };
  return (
    <>
      <div className="sn-glass-row sticky top-0 z-20 -mx-4 px-4 pb-2.5 pt-2" data-details-bar="">
        <p className="flex min-w-0 items-baseline gap-2 py-1">
          <span className="whitespace-nowrap text-[17px] font-semibold text-ink">{who}</span>
          <span className="min-w-0 truncate text-[13px] text-ink/60">{line}</span>
        </p>
        <div role="tablist" aria-label="Event Details" className={I_SEGMENTED_CLASS} data-details-segments="">
          {DETAILS_SEGMENTS.map((s) => {
            const on = s.key === at;
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`details-${s.key}`}
                onClick={() => pick(s.key)}
                data-seg={`details-${s.key}`}
                className={iSegClass(on, 'wine')}
              >
                {s.title}
                {s.key === 'access' && accessBadge ? <span className="font-medium opacity-80">{accessBadge}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      {DETAILS_SEGMENTS.map((s) => (
        <div key={s.key} id={`details-${s.key}`} role="tabpanel" hidden={s.key !== at} data-details-body={s.key}>
          {bodies[s.key]}
        </div>
      ))}
    </>
  );
}
