'use client';

import { useEffect, useState, useTransition } from 'react';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import {
  ACCESS_LEVEL_LABEL,
  accessNote,
  type GuestAccessLevel,
  type GuestAccessState,
} from '@/lib/guest-access';
import { setGuestAccess } from '../[guestId]/access-actions';

/*
 * ⚖ ITS OWN FILE, like `guest-invite-cell.tsx`: the Guest list's roster is the
 * only surface that draws a per-row Access control, so the roster's bundle
 * carries it and nothing else pays for it.
 */

/**
 * THE GUEST LIST'S ACCESS COLUMN — the guest card's Access line, in a row's
 * width (owner 2026-09-28: any co-host picks a guest's Access — None · Co-host ·
 * Limited helper — and it goes live once that guest has joined).
 *
 * 🔑 NOT A SECOND MECHANISM. It reads the state the page already loaded for
 * the "+Co-host" tags (`loadGuestAccessMap`, one read for the whole list) and
 * writes through the SAME server action the card's line calls
 * (`setGuestAccess`), so the column and the card can never disagree about
 * what a pick means. One guest at a time — the bulk "Part of the host" picker
 * was retired by the owner and does not come back here.
 *
 *   · ONE PickMenu dropdown for the three choices (owner: "if there are
 *     choices … drop down menu").
 *   · The creator and a celebrant co-host are FIXED — shown as their word,
 *     never as a dropdown the database would refuse.
 *   · Only a co-host may change it (`canManage` = the caller's `couple`
 *     membership, the action's own gate); anyone else reads the word.
 *   · A pick shows at once and saves in the background (the Maker's rule:
 *     ≤100 ms per tap). A refusal puts the word back and says why.
 */
export function GuestAccessCell({
  eventId,
  guestId,
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
  /** 'phone' draws the chip-sized dropdown the phone's one sub-line has room for. */
  size?: 'row' | 'phone';
}) {
  const [shown, setShown] = useState(state);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  useEffect(() => setShown(state), [state]);

  const word = ACCESS_LEVEL_LABEL[shown.level];
  const waiting = shown.level !== 'none' && !shown.live;
  const phone = size === 'phone';

  if (!canManage || shown.lock) {
    // Read-only: the word, and why it is fixed (the same note the card prints).
    // A phone's one sub-line does not spend a chip on "None" for every guest.
    if (phone && shown.level === 'none') return null;
    return (
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap text-xs ${
          shown.level === 'none' ? 'text-ink/40' : 'text-ink/70'
        }`}
        title={shown.lock ? accessNote(shown, firstName) : undefined}
        data-guest-access-cell={shown.lock ?? 'read-only'}
      >
        {shown.level === 'none' ? '—' : word}
        {waiting ? <span className="text-ink/45">· waiting</span> : null}
      </span>
    );
  }

  const options: PickOption[] = (['none', 'co_host', 'limited_helper'] as const).map((k) => ({
    key: k,
    label: ACCESS_LEVEL_LABEL[k],
  }));

  const pick = (key: string) => {
    const level = key as GuestAccessLevel;
    if (level === shown.level) return;
    const before = shown;
    // Shown at once; the database decides whether it is live yet.
    setShown({ level, live: false, lock: null });
    setError(null);
    startTransition(async () => {
      const res = await setGuestAccess(eventId, guestId, level);
      if (res.ok) setShown(res.state);
      else {
        setShown(before);
        setError(res.error);
      }
    });
  };

  return (
    <span className={phone ? 'inline-flex items-center' : 'flex flex-col items-start gap-0.5'} data-guest-access-cell="">
      <PickMenu
        label={`${firstName}'s access to this event`}
        // PickMenu matches `value` against option KEYS, not labels.
        value={shown.level}
        options={options}
        onPick={pick}
        dataAttr="data-guest-access-pick"
        compact={phone}
        buttonText={phone && waiting ? `${word} · waiting` : undefined}
      />
      {!phone && waiting ? (
        <span className="text-[10px] text-ink/45" aria-live="polite">
          waiting for them to join
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="text-[10px] text-terracotta-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}
