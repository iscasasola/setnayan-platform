'use client';

import Link from 'next/link';
import {
  ACCESS_LEVEL_LABEL,
  accessNote,
  type GuestAccessState,
} from '@/lib/guest-access';
import { peopleWithAccessHref } from '@/lib/people-with-access-href';

/*
 * ⚖ ITS OWN FILE, like `guest-invite-cell.tsx`: the Guest list's roster is the
 * only surface that draws a per-row Access cell, so the roster's bundle
 * carries it and nothing else pays for it.
 */

/**
 * THE GUEST LIST'S ACCESS COLUMN — SHOWS a guest's Access (None · Co-host ·
 * Limited helper); it no longer sets it.
 *
 * ⚖ Owner 2026-10-03 ("People with access"): access is set per person, per
 * area, in ONE place — Event Details › People with access. Other places SHOW
 * access and link there, never set it (replace means remove), so the column's
 * dropdown (2026-09-28, `setGuestAccess`) moved there. For a co-host the word
 * is the door: tapping it opens that section, where the same action runs.
 *
 * 🔑 NOT A SECOND MECHANISM. It reads the state the page already loaded
 * (`loadGuestAccessMap`, one read for the whole list) — the same words the
 * card's Access line and the section print.
 */
export function GuestAccessCell({
  eventId,
  firstName,
  state,
  canManage,
  size = 'row',
}: {
  eventId: string;
  guestId: string;
  firstName: string;
  state: GuestAccessState;
  canManage: boolean;
  /** 'phone' draws the chip-sized word the phone's one sub-line has room for. */
  size?: 'row' | 'phone';
}) {
  const word = ACCESS_LEVEL_LABEL[state.level];
  const waiting = state.level !== 'none' && !state.live;
  const phone = size === 'phone';
  // A phone's one sub-line does not spend a chip on "None" for every guest.
  if (phone && state.level === 'none') return null;
  const body = (
    <>
      {state.level === 'none' ? '—' : word}
      {waiting ? <span className="text-ink/45">· waiting</span> : null}
    </>
  );
  const cls = `inline-flex items-center gap-1 whitespace-nowrap text-xs ${
    state.level === 'none' ? 'text-ink/40' : 'text-ink/70'
  }`;
  if (!canManage) {
    return (
      <span className={cls} title={state.lock ? accessNote(state, firstName) : undefined} data-guest-access-cell="read-only">
        {body}
      </span>
    );
  }
  return (
    <Link
      href={peopleWithAccessHref(eventId)}
      className={`${cls} underline-offset-2 hover:underline`}
      aria-label={`${firstName}'s access: ${word}. Change it in People with access`}
      data-guest-access-cell="link"
    >
      {body}
    </Link>
  );
}
