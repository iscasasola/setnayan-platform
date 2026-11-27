/**
 * /dev/bar-lab's own Planning fixtures — two made-up events for the lab's Events body. DEV-ONLY sample data (labs may
 * use it); the product itself shows no sample cards (owner R3, 27 Nov 2026).
 */
import type { EventPosterFacts } from '@/lib/event-poster';

export type LabPlanningEvent = {
  id: string;
  badge: string;
  name: string;
  weekday: string;
  date: string;
  meta: string;
  photo: string;
  pct: number;
  remainder: string;
};

export const LAB_PLANNING: readonly LabPlanningEvent[] = [
  {
    id: 'lab-wedding',
    badge: 'Wedding',
    name: 'Ana & Miguel',
    weekday: 'Saturday',
    date: '12 December 2026',
    meta: 'Wedding · Saturday 12 December 2026',
    photo: '/event-types/wedding.webp',
    pct: 42,
    remainder: '163 days to go',
  },
  {
    id: 'lab-debut',
    badge: 'Debut',
    name: 'Sofia turns 18',
    weekday: 'Sunday',
    date: '7 March 2027',
    meta: 'Debut · Sunday 7 March 2027',
    photo: '/event-types/debut.webp',
    pct: 12,
    remainder: '248 days to go',
  },
];

/** The lab event as the poster the Planning card draws. */
export function labPoster(e: LabPlanningEvent): EventPosterFacts {
  const [first, second] = e.name.split(' & ');
  return {
    kind: 'photo',
    accent: null,
    capiz: false,
    dark: true,
    names: { first: first ?? e.name, second: second ?? null },
    weekday: e.weekday,
    date: e.date,
    eyebrow: null,
    line: null,
    venue: null,
    photoSrc: e.photo,
    ground: 'hero',
    legibility: null,
  };
}
