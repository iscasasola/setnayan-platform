'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FORM_PICK_CLASS, FormRow, usePillWidth } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { ACCESS_LEVEL_LABEL, accessNote, type GuestAccessLevel, type GuestAccessState } from '@/lib/guest-access';
import { setGuestAccess } from '../[guestId]/access-actions';

/**
 * guest-access-pick.tsx — "Access ▾" on a LINKED guest's card (owner, 24 Oct 2026, verbatim: *"Add the Access dropdown on the
 * guest card too."* — superseding, for this case, the 03 Oct "one setter only" rule).
 *
 * 🔑 ONE MECHANISM, TWO DOORS. It calls the SAME server action Event Details › People with access calls —
 * `setGuestAccess(eventId, guestId, next)` (`guests/[guestId]/access-actions.ts`) — so the same permission check (only a co-host
 * changes access; the creator's row stays the host; a celebrant co-host stays), the same seat column
 * (`event_moderators.role_subtype`), and the same revalidation of the Guests, Hosts and Details pages. No new action, no new
 * column. Held by `the-access-column-is-the-cards-access-line.test.ts`.
 *
 *   · A landed change shows the database's answer (`res.state`) and refreshes the card, so both doors read the same value.
 *   · A refusal puts the pick back and says why, in the action's own words — never the look of success.
 *
 * Handed in by the Guests pages (`AccessPick`), never imported by `GuestCardBody` — the Maker's first load stays as it is.
 */
export function GuestAccessPick({
  eventId,
  guestId,
  firstName,
  initial,
}: {
  eventId: string;
  guestId: string;
  firstName: string;
  initial: GuestAccessState;
}) {
  const router = useRouter();
  const width = usePillWidth();
  const [level, setLevel] = useState<GuestAccessLevel>(initial.level);
  const [state, setState] = useState<GuestAccessState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  useEffect(() => {
    setLevel(initial.level);
    setState(initial);
  }, [initial]);

  const pick = (key: string) => {
    const next = key as GuestAccessLevel;
    if (next === level) return;
    const before = level;
    setLevel(next);
    setError(null);
    startTransition(async () => {
      try {
        const res = await setGuestAccess(eventId, guestId, next);
        if (!res.ok) {
          setLevel(before);
          setError(res.error);
          return;
        }
        // The database decided whether the seat is live — show ITS answer, then redraw the card from the server.
        setLevel(res.state.level);
        setState(res.state);
        router.refresh();
      } catch {
        setLevel(before);
        setError('Couldn’t change access — check your connection and try again.');
      }
    });
  };

  return (
    <FormRow name="Access" about={{ words: accessNote(state, firstName) }} problem={error} data="card-access" attrs={{ 'data-card-access-pick': '' }}>
      <PickMenu
        label={`${firstName}'s access to this event`}
        value={level}
        options={(['co_host', 'limited_helper', 'none'] as const).map((k) => ({ key: k, label: ACCESS_LEVEL_LABEL[k] }))}
        onPick={pick}
        dataAttr="data-person-access-pick"
        className={`${FORM_PICK_CLASS} ${width}`}
      />
    </FormRow>
  );
}
