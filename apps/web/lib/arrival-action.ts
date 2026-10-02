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
import { SITE_MENU_ANCHORS } from '@/app/[slug]/_lib/site-menu';

/**
 * 🔴 THE HREFS COME FROM THE PAGE'S OWN ANCHOR MAP, NOT FROM WORDS THAT READ
 * WELL. The first version of this file invented `#your-qr`, `#schedule`,
 * `#photos` and `#rsvp`; NONE of those ids exist on the invitation, so every
 * link scrolled nowhere and said nothing — a fragment link to a missing id
 * fails silently, which is the quietest failure this page can have.
 *
 * `PASS_ANCHOR` is the one id this slice adds; the rest are the ids the site
 * menu already resolves, so they cannot drift apart from the sections.
 */
export const PASS_ANCHOR = 'site-pass';

/** The reply sheet's anchor (`RSVP_SHEET_ANCHORS` in rsvp-sheet-state.ts pins that it opens). */
export const REPLY_SHEET_ANCHOR = 'your-details';

export type ArrivalAction = {
  /** The accented control's words — the status, not a generic verb. */
  label: string;
  href: string;
  /** One line under the control. Null when the label says enough. */
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
 * Does this action open the reply sheet? Then the page needs no OTHER "change
 * your reply" control — the Welcome's one action is it (owner 2026-10-03: each
 * control has ONE place). On the day and after, the action points elsewhere
 * and the reply stays reachable from Me.
 */
export function actionOpensReply(action: ArrivalAction | null): boolean {
  return action !== null && (action.kind === 'ask' || action.kind === 'going' || action.kind === 'declined');
}

/**
 * Resolve the one action. Returns null for a reader we have nothing specific to
 * say to — an anonymous visitor keeps the page's existing public call to action
 * rather than being given a second, weaker one.
 */
export function resolveArrivalAction(input: ArrivalActionInput): ArrivalAction | null {
  const rsvp = input.rsvpStatus ?? null;
  if (rsvp === null) return null;

  // The reply SHEET's own anchor — never `#site-me`: Me is the guest's ticket and
  // must open on it, not under a sheet (rsvp-sheet-state.ts, walk-through 2026-10-01).
  const rsvpHref = input.rsvpHref ?? `/${input.slug}#${REPLY_SHEET_ANCHOR}`;
  const day = isIsoDay(input.eventDate) ? input.eventDate.slice(0, 10) : null;
  const today = isIsoDay(input.today) ? input.today.slice(0, 10) : null;

  // String comparison, both sides YYYY-MM-DD in Manila. See the file note.
  const isToday = day !== null && today !== null && today === day;
  const isAfter = day !== null && today !== null && today > day;

  if (isToday && rsvp !== 'declined') {
    return input.hasPass
      ? {
          label: 'Show your ticket',
          href: `/${input.slug}#${PASS_ANCHOR}`,
          // ✂ No explainer under it (owner 2026-10-03, "too much going on";
          // BUILD_PROMPTS rule 13: no small grey explainer captions).
          note: null,
          kind: 'day-of',
        }
      : {
          label: 'Today’s programme',
          href: `/${input.slug}#${SITE_MENU_ANCHORS.details}`,
          note: null,
          kind: 'day-of',
        };
  }

  if (isAfter) {
    return { label: 'See the photos', href: `/${input.slug}#${SITE_MENU_ANCHORS.gallery}`, note: null, kind: 'after' };
  }

  /* ☝ ONE CONTROL, NOT TWO TO ONE PLACE (owner 2026-10-03, on the live hub:
     "too many buttons"). "You're going" and a "Change" beside it both opened
     the SAME reply sheet; the status label is the door, so it stands alone. */
  if (rsvp === 'attending') {
    return { label: 'You’re going', href: rsvpHref, note: null, kind: 'going' };
  }

  if (rsvp === 'declined') {
    return { label: 'You said you can’t make it', href: rsvpHref, note: null, kind: 'declined' };
  }

  // 'pending' and 'maybe' both still owe the couple an answer.
  return {
    label: 'RSVP',
    href: rsvpHref,
    note: rsvp === 'maybe' ? 'You answered “maybe” — they’d love to know either way.' : null,
    kind: 'ask',
  };
}
