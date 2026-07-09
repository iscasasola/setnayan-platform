import type { LucideIcon } from 'lucide-react';
import { CalendarHeart, MailOpen, Radio, Newspaper } from 'lucide-react';
import type { LifecyclePhase } from '@/lib/invitation-widgets';

/**
 * The couple's public site, NAMED as four pages (owner R5 · Option A · 2026-07-09).
 *
 * There is exactly ONE public route — `/[slug]` — and it already renders a
 * different surface per lifecycle phase (see `getLifecyclePhase` in
 * `lib/invitation-widgets.ts`, consumed by `app/[slug]/page.tsx`). This module is
 * a PURE mapping: it puts a friendly name + blurb + icon on each of the four
 * existing `LifecyclePhase` values so the Launch section can present the one
 * engine as four previewable pages. It builds NO new engine and adds NO route.
 *
 * `phaseParam` is passed straight through as the public page's `?phase=` preview
 * override — honored there for the event's own signed-in hosts (a couple in the
 * dashboard), so the Launch "Preview" link opens the real, Mood-Board-styled
 * public page in that exact phase regardless of today's date.
 */
export type PublicSitePage = {
  /** Stable key === the LifecyclePhase it maps to. */
  key: LifecyclePhase;
  /** Friendly page name shown to the couple. */
  name: string;
  /** One-line description of what this page is. */
  blurb: string;
  /** The public page's `?phase=` value that renders this named page. */
  phaseParam: LifecyclePhase;
  /** Card glyph (matches the Launch surface's `Icon: LucideIcon` idiom). */
  Icon: LucideIcon;
};

/**
 * The four named public pages, in lifecycle order. Each maps 1:1 to an existing
 * `LifecyclePhase` — no phase is invented and none is left out.
 */
export const PUBLIC_SITE_PAGES: PublicSitePage[] = [
  {
    key: 'save_the_date',
    name: 'Save-the-Date',
    blurb: 'The first look — your monogram, the date, and a countdown. Announces the day and asks nothing of guests yet.',
    phaseParam: 'save_the_date',
    Icon: CalendarHeart,
  },
  {
    key: 'rsvp',
    name: 'RSVP',
    blurb: 'The invitation proper — details, schedule, and the form guests reply on in the run-up to the day.',
    phaseParam: 'rsvp',
    Icon: MailOpen,
  },
  {
    key: 'event',
    name: 'Day-of',
    blurb: 'The live wedding-day surface — schedule, each guest’s seat, the photo wall, and the livestream.',
    phaseParam: 'event',
    Icon: Radio,
  },
  {
    key: 'editorial',
    name: 'Editorial',
    blurb: 'The after-story — your gallery and recap, kept for the guests who were there.',
    phaseParam: 'editorial',
    Icon: Newspaper,
  },
];
