import type { LifecyclePhase } from '@/lib/invitation-widgets';

/**
 * THE WORDS FOR THE FOUR STAGES OF THE ONE LINK — in ONE place.
 *
 * Owner, 2026-09-24, looking at three surfaces that name the same four pages
 * three different ways:
 *
 *   controller ........ Save-the-Date · RSVP · Day-of · Editorial
 *   editor preview .... Save-the-Date · Invitation · RSVP'd · Wedding day · After
 *   owner ribbon ...... Save the Date · Invitation · On the day · After
 *
 * ✅ HE CHOSE, 2026-09-24, verbatim: *"Save the Date · Invitation · On the Day ·
 * Post Event"*. Those are the four below, mapped onto the phase params the
 * public route already accepts. Every surface that adopts the shared stage
 * (`app/_components/site-stage/`) reads this record and nothing else — do not
 * re-type a stage name beside a chip. (The editor preview and the owner ribbon
 * still carry their own words until they adopt it; see the changelog.)
 *
 * "RSVP'd" is NOT a fifth stage in this set: it is a WHO, not a WHEN — the
 * `rsvp` phase seen by a guest who already replied (`?as=replied`).
 *
 * 🔑 NO ICONS, NO IMPORTS BUT A TYPE. This module is read by a `'use client'`
 * component; `public-site-pages.ts` carries lucide components and must never be
 * the thing a client reaches for a label through (a component crossing the
 * server→client boundary took production down on 2026-09-23).
 */
export const PUBLIC_STAGE_LABELS = {
  save_the_date: 'Save the Date',
  rsvp: 'Invitation',
  event: 'On the Day',
  editorial: 'Post Event',
} as const satisfies Record<LifecyclePhase, string>;

/** The four stages in the order the site lives through them. */
export const PUBLIC_STAGE_ORDER = [
  'save_the_date',
  'rsvp',
  'event',
  'editorial',
] as const satisfies readonly LifecyclePhase[];
