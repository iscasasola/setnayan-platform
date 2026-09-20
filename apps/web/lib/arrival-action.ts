/**
 * apps/web/lib/arrival-action.ts
 *
 * ONE ACTION UNDER THE MARK, AND ITS LABEL IS THE STATUS.
 *
 * Second slice of the arrival design (owner-approved canvas, 2026-09-20). The
 * pattern every event app in the research shares: a single accented control
 * whose WORDS say where the reader stands. Before a reply it asks for one;
 * after, it states the answer and offers the change; on the day it stops asking
 * about a reply nobody can usefully give and points at the thing a guest needs
 * at a door.
 *
 * WHY ONE. The same research found the thing that separates calm from
 * templated is a single accented control per screen. The invitation already
 * carries an RSVP section, a status card and a menu; this does not add a sixth
 * thing to read, it names the one that matters at the top.
 *
 * ⚠ NOT A SECOND FIXED BAR. `GuestHubBar` was retired precisely because a
 * `fixed bottom-0 z-40` bar covered the menu whole (see the note in
 * site-body.tsx). This renders in the flow, directly under the hero.
 *
 * 🕐 THE DAY BOUNDARY IS MANILA'S. `manilaToday()` formats the current instant
 * in Asia/Manila; `new Date('YYYY-MM-DD')` is midnight UTC, which is the
 * PREVIOUS day in Manila and would flip this a full eight hours early. Both
 * sides of the comparison are therefore plain `YYYY-MM-DD` strings compared as
 * strings — no Date arithmetic anywhere in this file.
 *
 * Pure: today is passed in, so every branch is executed by a test.
 */

import type { RsvpStatus } from '@/lib/guests';

export type ArrivalAction = {
  /** The accented control's words — the status, not a generic verb. */
  label: string;
  href: string;
  /** A quiet second control, when there is one worth offering. */
  secondary?: { label: string; href: string };
  /** One line under the pair. Null when the label says enough. */
  note: string | null;
  /** Which branch produced this, for the test and for the markup's data attribute. */
  kind: 'ask' | 'going' | 'declined' | 'day-of' | 'after';
};

export type ArrivalActionInput = {
  slug: string;
  /** The reader's own reply, or null when they are not an identified guest. */
  rsvpStatus?: RsvpStatus | null;
  /** The event's calendar date, `YYYY-MM-DD`. */
  eventDate?: string | null;
  /** `manilaToday()` — see the file note. Passed in so this stays pure. */
  today: string;
  /** Whether this guest has a QR worth showing at the door. */
  hasPass?: boolean;
  /** Where the RSVP lives on this page. */
  rsvpHref?: string;
};

function isIsoDay(v: string | null | undefined): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.slice(0, 10));
}

/**
 * Resolve the one action. Returns null for a reader we have nothing specific to
 * say to — an anonymous visitor keeps the page's existing public call to action
 * rather than being given a second, weaker one.
 */
export function resolveArrivalAction(input: ArrivalActionInput): ArrivalAction | null {
  const rsvp = input.rsvpStatus ?? null;
  if (rsvp === null) return null;

  const rsvpHref = input.rsvpHref ?? `/${input.slug}#rsvp`;
  const day = isIsoDay(input.eventDate) ? input.eventDate.slice(0, 10) : null;
  const today = isIsoDay(input.today) ? input.today.slice(0, 10) : null;

  // String comparison, both sides YYYY-MM-DD in Manila. See the file note.
  const isToday = day !== null && today !== null && today === day;
  const isAfter = day !== null && today !== null && today > day;

  if (isToday && rsvp !== 'declined') {
    return input.hasPass
      ? {
          label: 'Show your pass',
          href: `/${input.slug}#your-qr`,
          note: 'It opens the door and finds your table.',
          kind: 'day-of',
        }
      : {
          label: 'Today’s programme',
          href: `/${input.slug}#schedule`,
          note: null,
          kind: 'day-of',
        };
  }

  if (isAfter) {
    return { label: 'See the photos', href: `/${input.slug}#photos`, note: null, kind: 'after' };
  }

  if (rsvp === 'attending') {
    return {
      label: 'You’re going',
      href: rsvpHref,
      secondary: { label: 'Change', href: rsvpHref },
      note: null,
      kind: 'going',
    };
  }

  if (rsvp === 'declined') {
    return {
      label: 'You said you can’t make it',
      href: rsvpHref,
      secondary: { label: 'Change', href: rsvpHref },
      note: null,
      kind: 'declined',
    };
  }

  // 'pending' and 'maybe' both still owe the couple an answer.
  return {
    label: 'RSVP',
    href: rsvpHref,
    note: rsvp === 'maybe' ? 'You answered “maybe” — they’d love to know either way.' : null,
    kind: 'ask',
  };
}
