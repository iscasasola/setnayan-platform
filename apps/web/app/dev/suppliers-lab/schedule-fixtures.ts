/**
 * Booked › Schedule › Preparation and Journey on fixtures (the Suppliers lab) — the dated steps of frame 20 of the
 * approved final Suppliers design (`carry-2026-10-29/suppliers-final-proto/`), on this lab's own booked suppliers, run
 * through the SHIPPED shapes (`PreparationAgenda`, `buildJourneyTimeline`) so the real views draw them.
 */
import type { PreparationAgenda, PreparationItem, PreparationSource } from '@/lib/preparation';
import { buildJourneyTimeline, type JourneyTimeline } from '@/lib/journey';
import { PLAN_DATE } from '../schedule-lab/lab-moments';

const DAY = 86_400_000;

function item(now: Date, iso: string, source: PreparationSource, title: string, subtitle: string, amountPhp?: number, kind?: PreparationItem['kind']): PreparationItem {
  const date = new Date(`${iso}T12:00:00`);
  return {
    id: `lab-${iso}-${title}`,
    source,
    kind,
    date,
    daysFromNow: Math.round((date.getTime() - now.getTime()) / DAY),
    title,
    subtitle,
    amountPhp,
    href: '/dev/suppliers-lab?mode=booked',
  };
}

export function labPrepAgenda(now: Date): PreparationAgenda {
  const items = [
    item(now, '2026-11-05', 'payment', 'First payment · Lumina Studio', 'Photo & Video', 20_000),
    item(now, '2026-11-12', 'meeting', 'Food tasting', 'Catering · with Bituin Catering · 3:00 PM'),
    item(now, '2026-11-20', 'paperwork', 'Marriage licence', 'Civil registry · 10-day posting'),
    item(now, '2026-12-11', 'payment', 'Balance · Seda Vertis North', 'Venue', 90_000),
    item(now, '2026-12-11', 'payment', 'Balance · Lumina Studio', 'Photo & Video', 45_000),
    item(now, '2026-12-15', 'manual', 'Final headcount to your caterer', 'Added by you', undefined, 'task'),
  ];
  const groups = new Map<string, PreparationItem[]>();
  for (const it of items) {
    const key = it.date.toISOString().slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  const sourceCounts: Record<PreparationSource, number> = { payment: 0, paperwork: 0, meeting: 0, milestone: 0, manual: 0 };
  for (const it of items) sourceCounts[it.source] += 1;
  return {
    items,
    groups: [...groups].map(([key, list]) => ({
      key,
      label: new Date(`${key}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      items: list,
    })),
    sourceCounts,
  };
}

export function labJourney(now: Date, agenda: PreparationAgenda): JourneyTimeline {
  return buildJourneyTimeline({
    eventId: 'lab',
    agenda,
    createdAt: '2026-03-02T08:00:00Z',
    eventDate: PLAN_DATE,
    recapPublishedAt: null,
    now,
    copy: { dayLabel: 'your wedding day', eventNoun: 'wedding' },
  });
}
