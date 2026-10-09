'use client';

import Link from 'next/link';

import { PILL_TRACK_CLASS, PILL_TRACK_GROUND, PillThumb, pillSegClass } from '@/app/_components/pill-selector';
import { formatCount } from '@/lib/format-number';

/**
 * Pending review | Enforcement decisions — the two sections of the concierge-abuse console, as the app's ONE pill
 * selector (owner 2026-10-08: *"adjust all pill selectors to this if possible"*; admin is included — only the guests'
 * Event Hub is not).
 *
 * Still two real `<Link>`s to the same two addresses the page always had. It is a client file ONLY so it can read
 * the template's class strings (they live in a client module); it holds no state. The picked link now says
 * `aria-current="page"` — the word the sliding thumb finds it by (it said nothing before).
 */
export function AbuseTabs({
  tab,
  pending,
  enforcement,
}: {
  tab: 'queue' | 'enforcement';
  /** How many are waiting — or null when the read was refused (the page then shows "—", never a 0). */
  pending: number | null;
  enforcement: number | null;
}) {
  return (
    <nav data-abuse-tabs="" className={`${PILL_TRACK_CLASS} ${PILL_TRACK_GROUND} mb-6 inline-flex`}>
      <PillThumb />
      <Link href="/admin/concierge-abuse?tab=queue" aria-current={tab === 'queue' ? 'page' : undefined} className={`${pillSegClass(tab === 'queue')} px-3`}>
        Pending review ({pending === null ? '—' : formatCount(pending)})
      </Link>
      <Link href="/admin/concierge-abuse?tab=enforcement" aria-current={tab === 'enforcement' ? 'page' : undefined} className={`${pillSegClass(tab === 'enforcement')} px-3`}>
        Enforcement decisions ({enforcement === null ? '—' : formatCount(enforcement)})
      </Link>
    </nav>
  );
}
